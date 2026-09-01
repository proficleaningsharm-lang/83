import { z } from 'zod';

// ─── Union / Literal Types ──────────────────────────────────────────

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export type SourceId = 'binance' | 'deriv' | 'twelvedata' | 'finnhub' | 'yahoo';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'market_closed'
  | 'degraded'
  | 'reconnecting'
  | 'failed';

export type SignalDirection = 'buy' | 'sell';

export type SignalOutcome = 'pending' | 'win' | 'loss' | 'timeout';

export type SignalStrength = 'weak' | 'moderate' | 'strong';

export type MarketRegime = 'trend' | 'range' | 'high-volatility';

export type SpreadSource = 'live' | 'estimated';

export type AssetClass = 'crypto' | 'forex';

export type PatternName =
  // Toggleable patterns (ALL_PATTERNS in settingsStore)
  | 'hammer'
  | 'shooting-star'
  | 'doji'
  | 'pin-bar'
  | 'bullish-engulfing'
  | 'bearish-engulfing'
  | 'bullish-harami'
  | 'bearish-harami'
  | 'inside-bar'
  | 'morning-star'
  | 'evening-star'
  | 'impulse-breakout'
  | 'consolidation-breakout'
  | 'liquidity-sweep'
  | 'liquidity-sweep-reaction'
  | 'mean-reversion'
  | 'strong-order-block-reaction'
  | 'order-block-continuation'
  | 'macd-deceleration-continuation'
  // "Стратегии на FVG" (fvg-return.ts, fvg-breaker-block.ts, fvg-nested.ts,
  // fvg-rejection.ts) — Strategies A-D from the source document.
  | 'fvg-return'
  | 'fvg-breaker-block'
  | 'fvg-nested'
  | 'fvg-rejection'
  // OB Breaker Block / Nested OB (order-block-breaker.ts, order-block-
  // nested.ts) — the Order Block counterparts of fvg-breaker-block/
  // fvg-nested above, built on smart-money.ts's `breakerBlocks`/
  // `orderBlocks` rather than super-order-block.ts (the detector behind
  // strong-order-block-reaction/order-block-continuation above).
  | 'order-block-breaker'
  | 'order-block-nested'
  // Additional patterns detected in patterns/index.ts
  | 'inverted-hammer'
  | 'hanging-man'
  | 'marubozu-bullish'
  | 'marubozu-bearish'
  | 'spinning-top'
  | 'piercing-line'
  | 'dark-cloud-cover'
  | 'tweezer-bottom'
  | 'tweezer-top'
  | 'three-white-soldiers'
  | 'three-black-crows'
  | 'abandoned-baby-bottom'
  | 'abandoned-baby-top'
  | 'rising-three-methods'
  | 'falling-three-methods';

export type IndicatorFeature =
  | 'rsi'
  | 'ema'
  | 'macd'
  | 'atr'
  | 'bollinger'
  | 'vwap'
  | 'volume-profile'
  | 'fibonacci'
  | 'liquidity-pools'
  | 'super-order-block'
  | 'support-resistance'
  | 'trend-structure'
  | 'market-regime'
  | 'impulse-velocity'
  | 'vsa-classifier'
  | 'order-block-strength'
  | 'level-rejection'
  | 'smart-money';

export type FeatureName = PatternName | IndicatorFeature;

// ─── Interfaces ─────────────────────────────────────────────────────

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Tick {
  price: number;
  time: number;
  bid?: number;
  ask?: number;
}

export interface PatternResult {
  name: PatternName;
  direction: SignalDirection;
  confidence: number;
  strength: SignalStrength;
  time: number;
  volumeConfirmed?: boolean;
  confirmedByNextCandle?: boolean;
  confluenceFactors?: string[];
  // Breakout candle extremes (impulse-breakout only) — used to place a
  // structural stop beyond the level that was just taken out instead of an
  // arbitrary ATR-multiple-from-entry stop. See computeBreakoutTradeLevels.
  breakoutLow?: number;
  breakoutHigh?: number;
  // Liquidity-sweep-reaction only — the swept bar's own extreme (the level
  // stop/take-profit should be structured around, not a flat ATR multiple).
  // See computeLiquiditySweepTradeLevels and the "Реакция на снятие
  // ликвидности" audit fix, finding #6.
  sweepLow?: number;
  sweepHigh?: number;
  // Liquidity-sweep-reaction only — nearest opposite-side OB/FVG edge beyond
  // entry, precomputed inside the detector (which has smartMoney in scope)
  // so the decision layer doesn't need its own copy of smartMoney to place a
  // structural take-profit. Null when no such zone was found.
  oppositeZonePrice?: number | null;
  // liquidity-sweep / liquidity-sweep-reaction only — which of the two
  // ICT/Wyckoff-valid trend contexts this setup matched: continuation (sweep
  // in the direction the market was already moving) or a reversal right at a
  // significant swing level (Spring/Upthrust). See audit finding #7.
  setupType?: 'continuation' | 'reversal-at-key-level';
}

export interface MarketStructure {
  trend: 'up' | 'down' | 'range';
  bos: boolean;
  choch: boolean;
  swingHigh: number | null;
  swingLow: number | null;
  provisional: boolean;
}

export interface SessionFilterConfig {
  london: boolean;
  newyork: boolean;
  overlap: boolean;
  tokyo: boolean;
  sydney: boolean;
}

export interface IndicatorConfig {
  rsiPeriod: number;
  emaFast: number;
  emaSlow: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  atrPeriod: number;
  bbPeriod: number;
  bbStdDev: number;
  // Задача 1.1 — прежде хардкодился как DEFAULT_SCORE_THRESHOLD внутри
  // signal-builder.ts/engine.ts. Минимальный итоговый score, при котором
  // сигнал вообще строится.
  scoreThreshold: number;
  // Этап 2 — прежде хардкодились как RSI_OVERSOLD/RSI_OVERBOUGHT (30/70) в
  // signal-builder.ts и напрямую как 30/70 в direction-prediction.ts.
  rsiOverbought: number;
  rsiOversold: number;
  // Задача 1.3 — порог pre-entry spread-gate: сигнал не строится, если
  // estimateSpread(...) вернул спред шире, чем atrValue * spreadGateMultiplier.
  spreadGateMultiplier: number;
  // Задача 1.2 — какие торговые сессии (по UTC-окнам getSessionRegime())
  // разрешено использовать для генерации сигналов. Это фильтр качества
  // ликвидности внутри торгового дня, отдельный от MarketHoursConfig
  // (открыт/закрыт рынок в принципе).
  sessionFilter: SessionFilterConfig;
}

export interface IndicatorSnapshot {
  rsi: number | null;
  emaFast: number | null;
  emaSlow: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  atr: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  vwap: number | null;
  vwapIsProxyVolume: boolean;
  volumeProfilePoc: number | null;
  volumeProfilePocIsProxyVolume: boolean;
  meanReversionRsi: number | null;
  impulseVelocity: number | null;
  adx: number | null;
}

export interface SeriesPoint {
  time: number;
  value: number | null;
}

export interface IndicatorSeries {
  rsi: SeriesPoint[];
  emaFast: SeriesPoint[];
  emaSlow: SeriesPoint[];
  macd: SeriesPoint[];
  macdSignal: SeriesPoint[];
  macdHistogram: SeriesPoint[];
  bollingerUpper: SeriesPoint[];
  bollingerMiddle: SeriesPoint[];
  bollingerLower: SeriesPoint[];
}

export interface Snapshot {
  indicators: IndicatorSnapshot;
  patterns: PatternResult[];
  structure: MarketStructure;
  regime: MarketRegime;
  lastPrice: number | null;
  candleTime: number | null;
}

export interface Signal {
  id: string;
  symbolId: string;
  direction: SignalDirection;
  strength: SignalStrength;
  score: number;
  calibratedProbability: number | null;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
  indicators: IndicatorSnapshot;
  pattern: PatternName | null;
  time: number;
  timeframe: Timeframe;
  outcome: SignalOutcome;
  frozenAt: number | null;
  isRevised: boolean;
  isPreClose: boolean;
  revisionNote: string | null;
  barsToResolve: number;
  spread: number | null;
  spreadSource: SpreadSource | null;
  recommendedExpiry: number;
  featureVector: number[];
  // Аудит (синхронизация с демо-счётом): true/false проставляется в момент
  // закрытия свечи (см. useTickStore.ts/tick-store/pre-close.ts) — была ли
  // по этому сигналу реально открыта демо-сделка (useDemoAccountStore).
  // undefined — устаревшая запись до этого фикса (трактуется как "да",
  // чтобы не переписывать задним числом уже посчитанную статистику).
  // Определяет: 1) кто выставляет финальный outcome — useDemoAccountStore
  // при закрытии сделки (true) или планировщик как fallback (false/undefined
  // без открытой сделки); 2) учитывается ли сигнал в винрейте (см.
  // recomputeStats/StatusBar) и как он подписывается в SignalCard.
  tradeOpened?: boolean;
}

export interface SpreadEstimate {
  spread: number;
  source: SpreadSource;
}

export interface CalibrationResult {
  symbolId: string;
  timeframe: Timeframe;
  atrMultiplier: number;
  stopLossPips: number;
  takeProfitPips: number;
  winRate: number;
  totalTrades: number;
  calibratedAt: number;
}

export interface CalibrationState {
  weights: number[];
  bias: number;
  sampleCount: number;
}

export interface MarketHoursConfig {
  openDays: boolean[];
  openMinutesUtc: number;
  closeMinutesUtc: number;
}

export interface Symbol {
  id: string;
  assetClass: AssetClass;
  displaySymbol: string;
  baseAsset: string;
  quoteAsset: string;
  displayName: string;
  pipSize: number;
  marketHours: MarketHoursConfig | null;
}

export interface DirectionComponents {
  structure: number;
  zones: number;
  liquidity: number;
  trigger: number;
  indicator: number;
  bos: number;
  macd: number;
  meanReversion: number;
}

export interface SignalComponentToggles {
  structure: boolean;
  zones: boolean;
  liquidity: boolean;
  trigger: boolean;
  indicator: boolean;
  bos: boolean;
  macd: boolean;
  meanReversion: boolean;
  contextPenalty: boolean;
  obConfirmation: boolean;
  fvgConfirmation: boolean;
  bosConfirmation: boolean;
  chochWarning: boolean;
  invalidation: boolean;
}

export const SIGNAL_COMPONENT_KEYS = [
  'structure',
  'zones',
  'liquidity',
  'trigger',
  'indicator',
  'bos',
  'macd',
  'meanReversion',
  'contextPenalty',
  'obConfirmation',
  'fvgConfirmation',
  'bosConfirmation',
  'chochWarning',
  'invalidation',
] as const;

export type SignalComponentKey = (typeof SIGNAL_COMPONENT_KEYS)[number];

export const DEFAULT_SIGNAL_TOGGLES: SignalComponentToggles = {
  structure: true,
  zones: true,
  liquidity: true,
  trigger: true,
  indicator: true,
  bos: true,
  macd: true,
  meanReversion: true,
  contextPenalty: true,
  obConfirmation: true,
  fvgConfirmation: true,
  bosConfirmation: true,
  chochWarning: true,
  invalidation: true,
};

// ─── Constants ──────────────────────────────────────────────────────

export const DEFAULT_SESSION_FILTER: SessionFilterConfig = {
  london: true,
  newyork: true,
  overlap: true,
  tokyo: true,
  sydney: true,
};

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  rsiPeriod: 14,
  emaFast: 20,
  emaSlow: 50,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  atrPeriod: 14,
  bbPeriod: 20,
  bbStdDev: 2,
  scoreThreshold: 2,
  rsiOverbought: 70,
  rsiOversold: 30,
  spreadGateMultiplier: 3,
  sessionFilter: { ...DEFAULT_SESSION_FILTER },
};

const PATTERN_NAMES: readonly PatternName[] = [
  'hammer',
  'shooting-star',
  'doji',
  'pin-bar',
  'bullish-engulfing',
  'bearish-engulfing',
  'bullish-harami',
  'bearish-harami',
  'inside-bar',
  'morning-star',
  'evening-star',
  'impulse-breakout',
  'consolidation-breakout',
  'liquidity-sweep',
  'liquidity-sweep-reaction',
  'mean-reversion',
  'strong-order-block-reaction',
  'order-block-continuation',
  'macd-deceleration-continuation',
  'fvg-return',
  'fvg-breaker-block',
  'fvg-nested',
  'fvg-rejection',
  'order-block-breaker',
  'order-block-nested',
  // Additional patterns detected in patterns/index.ts — previously missing
  // here, which meant backtest/config.ts's DEFAULT_BACKTEST_CONFIG (built
  // from ALL_FEATURES) silently never evaluated them (same root-cause bug
  // as ALL_PATTERNS in settingsStore.ts).
  'inverted-hammer',
  'hanging-man',
  'marubozu-bullish',
  'marubozu-bearish',
  'spinning-top',
  'piercing-line',
  'dark-cloud-cover',
  'tweezer-bottom',
  'tweezer-top',
  'three-white-soldiers',
  'three-black-crows',
  'abandoned-baby-bottom',
  'abandoned-baby-top',
  'rising-three-methods',
  'falling-three-methods',
];

const INDICATOR_FEATURES: readonly IndicatorFeature[] = [
  'rsi',
  'ema',
  'macd',
  'atr',
  'bollinger',
  'vwap',
  'volume-profile',
  'fibonacci',
  'liquidity-pools',
  'super-order-block',
  'support-resistance',
  'trend-structure',
  'market-regime',
  'impulse-velocity',
  'vsa-classifier',
  'order-block-strength',
  'level-rejection',
  'smart-money',
];

export const ALL_FEATURES: readonly FeatureName[] = [
  ...PATTERN_NAMES,
  ...INDICATOR_FEATURES,
];

// ─── Zod Schemas ────────────────────────────────────────────────────

export const timeframeSchema = z.enum([
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1d',
]);

export const sourceIdSchema = z.enum([
  'binance',
  'deriv',
  'twelvedata',
  'finnhub',
  'yahoo',
]);

export const connectionStatusSchema = z.enum([
  'idle',
  'connecting',
  'live',
  'market_closed',
  'degraded',
  'reconnecting',
  'failed',
]);

export const signalDirectionSchema = z.enum(['buy', 'sell']);

export const signalOutcomeSchema = z.enum(['pending', 'win', 'loss', 'timeout']);

export const signalStrengthSchema = z.enum(['weak', 'moderate', 'strong']);

export const patternNameSchema = z.enum([
  'hammer',
  'shooting-star',
  'doji',
  'pin-bar',
  'bullish-engulfing',
  'bearish-engulfing',
  'bullish-harami',
  'bearish-harami',
  'inside-bar',
  'morning-star',
  'evening-star',
  'impulse-breakout',
  'consolidation-breakout',
  'liquidity-sweep',
  'liquidity-sweep-reaction',
  'mean-reversion',
  'strong-order-block-reaction',
  'order-block-continuation',
  'macd-deceleration-continuation',
  'fvg-return',
  'fvg-breaker-block',
  'fvg-nested',
  'fvg-rejection',
  'order-block-breaker',
  'order-block-nested',
  'inverted-hammer',
  'hanging-man',
  'marubozu-bullish',
  'marubozu-bearish',
  'spinning-top',
  'piercing-line',
  'dark-cloud-cover',
  'tweezer-bottom',
  'tweezer-top',
  'three-white-soldiers',
  'three-black-crows',
  'abandoned-baby-bottom',
  'abandoned-baby-top',
  'rising-three-methods',
  'falling-three-methods',
]);

export const assetClassSchema = z.enum(['crypto', 'forex']);

export const featureNameSchema = z.enum([
  ...patternNameSchema.options,
  ...INDICATOR_FEATURES,
] as unknown as [FeatureName, ...FeatureName[]]);

export const candleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export const tickSchema = z.object({
  price: z.number(),
  time: z.number(),
  bid: z.number().optional(),
  ask: z.number().optional(),
});

export const patternResultSchema = z.object({
  name: patternNameSchema,
  direction: signalDirectionSchema,
  confidence: z.number().min(0).max(1),
  strength: signalStrengthSchema,
  time: z.number(),
  volumeConfirmed: z.boolean().optional(),
  confirmedByNextCandle: z.boolean().optional(),
  confluenceFactors: z.array(z.string()).optional(),
  // Kept in sync with the PatternResult interface above — this schema isn't
  // exercised by any live .parse()/.safeParse() call today (the worker
  // boundary uses postMessage's structured clone, not zod), so a missing
  // field here wouldn't break anything *right now*. But if runtime
  // validation is ever added at that boundary (a reasonable thing to want),
  // an out-of-sync schema would silently strip these fields via zod's
  // default unknown-key stripping — turning a real structural SL/TP input
  // into a silently-dropped one. Found and fixed during the "Реакция на
  // снятие ликвидности" quality review, 2026-09-01.
  breakoutLow: z.number().optional(),
  breakoutHigh: z.number().optional(),
  sweepLow: z.number().optional(),
  sweepHigh: z.number().optional(),
  oppositeZonePrice: z.number().nullable().optional(),
  setupType: z.enum(['continuation', 'reversal-at-key-level']).optional(),
});

export const marketStructureSchema = z.object({
  trend: z.enum(['up', 'down', 'range']),
  bos: z.boolean(),
  choch: z.boolean(),
  swingHigh: z.number().nullable(),
  swingLow: z.number().nullable(),
});

export const marketRegimeSchema = z.enum(['trend', 'range', 'high-volatility']);

export const sessionFilterConfigSchema = z.object({
  london: z.boolean(),
  newyork: z.boolean(),
  overlap: z.boolean(),
  tokyo: z.boolean(),
  sydney: z.boolean(),
});

export const indicatorConfigSchema = z.object({
  rsiPeriod: z.number(),
  emaFast: z.number(),
  emaSlow: z.number(),
  macdFast: z.number(),
  macdSlow: z.number(),
  macdSignal: z.number(),
  atrPeriod: z.number(),
  bbPeriod: z.number(),
  bbStdDev: z.number(),
  scoreThreshold: z.number(),
  rsiOverbought: z.number(),
  rsiOversold: z.number(),
  spreadGateMultiplier: z.number(),
  sessionFilter: sessionFilterConfigSchema,
});

export const indicatorSnapshotSchema = z.object({
  rsi: z.number().nullable(),
  emaFast: z.number().nullable(),
  emaSlow: z.number().nullable(),
  macd: z.number().nullable(),
  macdSignal: z.number().nullable(),
  macdHistogram: z.number().nullable(),
  atr: z.number().nullable(),
  bollingerUpper: z.number().nullable(),
  bollingerMiddle: z.number().nullable(),
  bollingerLower: z.number().nullable(),
  vwap: z.number().nullable(),
  vwapIsProxyVolume: z.boolean(),
  volumeProfilePoc: z.number().nullable(),
  volumeProfilePocIsProxyVolume: z.boolean(),
  meanReversionRsi: z.number().nullable(),
  impulseVelocity: z.number().nullable(),
  adx: z.number().nullable(),
});

const seriesPointSchema = z.object({
  time: z.number(),
  value: z.number().nullable(),
});

export const indicatorSeriesSchema = z.object({
  rsi: z.array(seriesPointSchema),
  emaFast: z.array(seriesPointSchema),
  emaSlow: z.array(seriesPointSchema),
  macd: z.array(seriesPointSchema),
  macdSignal: z.array(seriesPointSchema),
  macdHistogram: z.array(seriesPointSchema),
  bollingerUpper: z.array(seriesPointSchema),
  bollingerMiddle: z.array(seriesPointSchema),
  bollingerLower: z.array(seriesPointSchema),
});

export const snapshotSchema = z.object({
  indicators: indicatorSnapshotSchema,
  patterns: z.array(patternResultSchema),
  structure: marketStructureSchema,
  regime: marketRegimeSchema,
  lastPrice: z.number().nullable(),
  candleTime: z.number().nullable(),
});

export const signalSchema = z.object({
  id: z.string(),
  symbolId: z.string(),
  direction: signalDirectionSchema,
  strength: signalStrengthSchema,
  score: z.number(),
  calibratedProbability: z.number().nullable(),
  entryPrice: z.number(),
  stopLoss: z.number(),
  takeProfit: z.number(),
  reason: z.string(),
  indicators: indicatorSnapshotSchema,
  pattern: patternNameSchema.nullable(),
  time: z.number(),
  timeframe: timeframeSchema,
  outcome: signalOutcomeSchema,
  frozenAt: z.number().nullable(),
  isRevised: z.boolean(),
  isPreClose: z.boolean(),
  revisionNote: z.string().nullable(),
  barsToResolve: z.number(),
  spread: z.number().nullable(),
  spreadSource: z.enum(['live', 'estimated']).nullable(),
  recommendedExpiry: z.number(),
  featureVector: z.array(z.number()),
});

export const calibrationResultSchema = z.object({
  symbolId: z.string(),
  timeframe: timeframeSchema,
  atrMultiplier: z.number(),
  stopLossPips: z.number(),
  takeProfitPips: z.number(),
  winRate: z.number(),
  totalTrades: z.number(),
  calibratedAt: z.number(),
});

export const marketHoursConfigSchema = z.object({
  openDays: z.array(z.boolean()),
  openMinutesUtc: z.number(),
  closeMinutesUtc: z.number(),
});

export const symbolSchema = z.object({
  id: z.string(),
  assetClass: assetClassSchema,
  displaySymbol: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  displayName: z.string(),
  pipSize: z.number(),
  marketHours: marketHoursConfigSchema.nullable(),
});
