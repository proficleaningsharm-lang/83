import type {
  Candle,
  Signal,
  SignalOutcome,
  Timeframe,
  IndicatorConfig,
  FeatureName,
} from '@/types/domain';
import { runEngine } from '@/engine/analysisEngine';
import { resolveOutcome } from '@/decision/outcome-scheduler';
import { estimateSpread } from '@/decision/spread-estimate';
import { applySpreadToOutcome } from '@/decision/apply-spread';
import { TIMEFRAME_SECONDS } from '@/data/symbols';

export interface SimulatedTrade {
  signal: Signal;
  outcome: SignalOutcome;
  entryTime: number;
  candleIndex: number;
  spreadCostR: number;
  inSample: boolean;
}

export interface SimulatorOptions {
  symbol: string;
  timeframe: Timeframe;
  indicatorConfig: IndicatorConfig;
  atrMultiplier: number;
  activeFeatures: FeatureName[];
  barsToResolve: number;
  windowSize: number;
  inSampleRatio: number;
}

export function simulate(candles: Candle[], options: SimulatorOptions): SimulatedTrade[] {
  const trades: SimulatedTrade[] = [];
  const tfSeconds = TIMEFRAME_SECONDS[options.timeframe];

  const warmup =
    Math.max(
      options.indicatorConfig.emaSlow,
      options.indicatorConfig.bbPeriod,
      options.indicatorConfig.macdSlow,
      options.indicatorConfig.rsiPeriod,
      options.indicatorConfig.atrPeriod,
    ) + 5;

  const minStart = Math.max(warmup, options.windowSize);
  const splitIndex = Math.floor((candles.length - minStart) * options.inSampleRatio) + minStart;

  for (let i = minStart; i < candles.length - options.barsToResolve; i++) {
    const window = candles.slice(i - options.windowSize + 1, i + 1);
    const lastCandle = candles[i];
    const serverNowMs = (lastCandle.time + tfSeconds) * 1000;

    const { signal } = runEngine({
      symbolId: options.symbol,
      timeframe: options.timeframe,
      candles: window,
      config: options.indicatorConfig,
      atrMultiplier: options.atrMultiplier,
      activeFeatures: options.activeFeatures,
      calibration: null,
      tick: null,
      barsToResolve: options.barsToResolve,
    });

    if (!signal) continue;

    const deterministicSignal: Signal = {
      ...signal,
      id: `${options.symbol}:${options.timeframe}:${i}`,
    };

    const futureCandles = candles.slice(i + 1, i + 1 + options.barsToResolve);
    const resolved = resolveOutcome(deterministicSignal, futureCandles);
    if (!resolved) continue;

    const { spread } = estimateSpread(options.symbol, null);
    // futureCandles[0] существует гарантированно: resolveOutcome() выше
    // возвращает non-null только когда futureCandles.length > 0.
    const adjusted = applySpreadToOutcome(resolved.outcome, deterministicSignal, spread, futureCandles[0].close);

    trades.push({
      signal: deterministicSignal,
      outcome: adjusted.outcome,
      entryTime: lastCandle.time,
      candleIndex: i,
      spreadCostR: adjusted.spreadCostR,
      inSample: i < splitIndex,
    });
  }

  return trades;
}

export function splitTrades(trades: SimulatedTrade[]): {
  inSample: SimulatedTrade[];
  outOfSample: SimulatedTrade[];
} {
  return {
    inSample: trades.filter((t) => t.inSample),
    outOfSample: trades.filter((t) => !t.inSample),
  };
}
