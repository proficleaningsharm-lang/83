import type { Candle, PatternResult, SignalStrength, IndicatorSnapshot, MarketStructure } from '@/types/domain';
import { superOrderBlocks } from '@/compute/indicators/super-order-block';
import { orderBlockStrength, detectImbalances } from '@/compute/indicators/order-block-strength';
import { supportResistance } from '@/compute/indicators/support-resistance';
import { macd } from '@/compute/indicators/macd';
import type { SessionRegime } from '@/compute/session-regime';
import { isHighLiquiditySession } from '@/compute/session-regime';

export interface OBCResult extends PatternResult {
  targetZone?: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function strengthForConfidence(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

const N_BARS = 12;
const MAX_FRESH_CANDLES = 3;

// Order Block Continuation: a fresh (1–3 candles) untested OB coincides with
// a |MACD histogram| extreme in the surrounding N bars, signalling momentum
// continuation away from the block.
export function detectOrderBlockContinuation(
  candles: Candle[],
  snapshot?: IndicatorSnapshot,
  session?: SessionRegime,
  structure?: MarketStructure,
): OBCResult | null {
  if (candles.length < 30) return null;

  // Displacement-gated by default (see super-order-block.ts). Structure
  // confirmation is now also mandatory whenever `structure` is available —
  // per the OB unification fix, a block without a same-direction BOS/CHoCH
  // at its formation isn't treated as tradeable here, not just "worth a
  // small bonus" as before.
  const blocks = superOrderBlocks(candles, 100, {
    structure,
    requireStructureConfluence: structure !== undefined,
  });
  const untestedBlocks = blocks.filter((b) => b.status === 'untested' || b.status === 'tested-hold');
  if (untestedBlocks.length === 0) return null;

  const last = candles[candles.length - 1];
  const closes = candles.map((c) => c.close);
  const { histogram } = macd(closes, 12, 26, 9);

  let bestResult: OBCResult | null = null;
  let bestConfidence = 0;

  for (const block of untestedBlocks) {
    // block.index/time are set at detection time in super-order-block.ts —
    // previously re-derived here via OHLC-value matching, which silently
    // picked the wrong candle whenever two candles shared identical OHLC.
    const blockIdx = block.index;
    if (blockIdx < 0 || blockIdx >= candles.length) continue;

    const candlesSinceFormation = candles.length - 1 - blockIdx;
    if (candlesSinceFormation < 1 || candlesSinceFormation > MAX_FRESH_CANDLES) continue;

    const windowStart = Math.max(0, blockIdx - 1);
    const windowEnd = Math.min(histogram.length, windowStart + N_BARS);
    const windowAbs: number[] = [];
    for (let j = windowStart; j < windowEnd; j++) {
      if (histogram[j] !== null) windowAbs.push(Math.abs(histogram[j] as number));
    }
    if (windowAbs.length < 4) continue;

    const obHistIdx = Math.max(0, Math.min(windowAbs.length - 1, blockIdx - windowStart));
    const obHistValue = windowAbs[obHistIdx] ?? 0;
    const maxHist = Math.max(...windowAbs);
    const avgHist = windowAbs.reduce((a, b) => a + b, 0) / windowAbs.length;

    // OB formation bar's histogram must be the extreme (or within 80% of it)
    if (obHistValue < maxHist * 0.8) continue;

    const confidenceRaw = clamp01(avgHist > 0 ? obHistValue / (avgHist * 2) : 0.5);
    const direction = block.direction === 'bullish' ? 'buy' : 'sell';

    // RSI-extreme hard filter (TIER 3, п.12): a fresh continuation block
    // entered while RSI already sits in an extreme reading is a documented
    // red flag, not just a minor confluence miss — skip this block entirely.
    if (snapshot?.rsi != null) {
      if (direction === 'buy' && snapshot.rsi > 75) continue;
      if (direction === 'sell' && snapshot.rsi < 25) continue;
    }

    let confidence = confidenceRaw;

    // Kill Zone bonus (TIER 2, п.7).
    if (session && isHighLiquiditySession(session)) confidence *= 1.2;

    // EMA confluence bonus (TIER 2, п.10): block sits on the "far side" of
    // the fast EMA relative to its direction (bullish block above emaFast,
    // bearish block below it).
    if (snapshot?.emaFast != null) {
      const emaAligned = direction === 'buy' ? block.low > snapshot.emaFast : block.high < snapshot.emaFast;
      if (emaAligned) confidence *= 1.1;
    }

    // BB expansion bonus (TIER 3, п.13) — approximation: IndicatorSnapshot
    // only carries the latest Bollinger values (no historical band-width
    // series to compare against), so we approximate "expansion" as the
    // current band width exceeding 2x ATR, rather than comparing to the
    // width N bars ago.
    if (snapshot?.bollingerUpper != null && snapshot?.bollingerLower != null && snapshot?.atr != null) {
      const bandWidth = snapshot.bollingerUpper - snapshot.bollingerLower;
      if (bandWidth > snapshot.atr * 2) confidence *= 1.05;
    }

    // Structure confluence bonus: kept for backward-compatible confidence
    // shape, though it's now a no-op in practice — blocks without structure
    // confluence are already excluded above whenever `structure` is passed
    // (requireStructureConfluence), so every surviving block here has
    // hasStructureConfluence === true.
    if (block.hasStructureConfluence) confidence *= 1.1;

    confidence = clamp01(confidence);
    if (confidence <= bestConfidence) continue;

    const targetZone = findTargetZone(candles, direction, last.close);

    bestConfidence = confidence;
    bestResult = {
      name: 'order-block-continuation',
      direction,
      confidence,
      strength: strengthForConfidence(confidence),
      time: last.time,
      targetZone,
    };
  }

  return bestResult;
}

function findTargetZone(
  candles: Candle[],
  direction: 'buy' | 'sell',
  currentPrice: number,
): number | undefined {
  const candidates: number[] = [];

  const obZones = orderBlockStrength(candles, 50, undefined, false);
  for (const z of obZones) {
    if (z.status === 'broken') continue;
    const level = direction === 'buy' ? z.high : z.low;
    if (direction === 'buy' && level > currentPrice) candidates.push(level);
    if (direction === 'sell' && level < currentPrice) candidates.push(level);
  }

  const fvgs = detectImbalances(candles);
  for (const f of fvgs) {
    if (f.invalidated) continue;
    const level = direction === 'buy' ? f.upper : f.lower;
    if (direction === 'buy' && level > currentPrice) candidates.push(level);
    if (direction === 'sell' && level < currentPrice) candidates.push(level);
  }

  const levels = supportResistance(candles);
  for (const l of levels) {
    if (direction === 'buy' && l.price > currentPrice) candidates.push(l.price);
    if (direction === 'sell' && l.price < currentPrice) candidates.push(l.price);
  }

  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) =>
    direction === 'buy'
      ? Math.abs(a - currentPrice) - Math.abs(b - currentPrice)
      : Math.abs(a - currentPrice) - Math.abs(b - currentPrice),
  );
  return candidates[0];
}
