import type { Signal, SignalOutcome, Timeframe, CalibrationState } from '@/types/domain';
import type { CalibrationSample } from '@/decision/calibration-model';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { addBreadcrumb } from '@/lib/sentry';
import { getClientId } from '@/lib/client-id';

const DELETE_PROXY_TIMEOUT_MS = 12_000;

const CALIBRATION_ROW_ID = '00000000-0000-0000-0000-000000000001';

interface SignalRow {
  id: string;
  symbol_id: string;
  timeframe: string;
  direction: string;
  strength: string;
  score: number;
  calibrated_probability: number | null;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  reason: string;
  pattern: string | null;
  indicators: Record<string, unknown>;
  outcome: string;
  is_revised: boolean;
  is_pre_close: boolean;
  revision_note: string | null;
  bars_to_resolve: number;
  spread: number | null;
  spread_source: string | null;
  recommended_expiry: number;
  feature_vector: number[];
  signal_time: number;
  frozen_at: number | null;
  created_at: string;
}

function signalToRow(s: Signal): Record<string, unknown> {
  return {
    id: s.id,
    symbol_id: s.symbolId,
    timeframe: s.timeframe,
    direction: s.direction,
    strength: s.strength,
    score: s.score,
    calibrated_probability: s.calibratedProbability,
    entry_price: s.entryPrice,
    stop_loss: s.stopLoss,
    take_profit: s.takeProfit,
    reason: s.reason,
    pattern: s.pattern,
    indicators: s.indicators,
    outcome: s.outcome,
    is_revised: s.isRevised,
    is_pre_close: s.isPreClose,
    revision_note: s.revisionNote,
    bars_to_resolve: s.barsToResolve,
    spread: s.spread,
    spread_source: s.spreadSource,
    recommended_expiry: s.recommendedExpiry,
    feature_vector: s.featureVector,
    signal_time: s.time,
    frozen_at: s.frozenAt,
  };
}

function rowToSignal(r: SignalRow): Signal {
  return {
    id: r.id,
    symbolId: r.symbol_id,
    timeframe: r.timeframe as Timeframe,
    direction: r.direction as Signal['direction'],
    strength: r.strength as Signal['strength'],
    score: r.score,
    calibratedProbability: r.calibrated_probability,
    entryPrice: r.entry_price,
    stopLoss: r.stop_loss,
    takeProfit: r.take_profit,
    reason: r.reason,
    pattern: r.pattern as Signal['pattern'],
    indicators: r.indicators as unknown as Signal['indicators'],
    outcome: r.outcome as SignalOutcome,
    frozenAt: r.frozen_at,
    isRevised: r.is_revised,
    isPreClose: r.is_pre_close,
    revisionNote: r.revision_note,
    barsToResolve: r.bars_to_resolve,
    spread: r.spread,
    spreadSource: r.spread_source as Signal['spreadSource'],
    recommendedExpiry: r.recommended_expiry,
    featureVector: r.feature_vector,
    time: r.signal_time,
  };
}

/**
 * Save a signal to the database. Silently does nothing if Supabase is not configured.
 */
export async function saveSignal(signal: Signal): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('trading_signals')
      .upsert(signalToRow(signal), { onConflict: 'id' });
    if (error) {
      addBreadcrumb('saveSignal failed', { error: error.message });
    }
  } catch {
    // Non-fatal: app works in-memory without persistence
  }
}

/**
 * Update a signal's outcome in the database.
 */
export async function updateSignalOutcome(
  signalId: string,
  outcome: SignalOutcome,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('trading_signals')
      .update({ outcome })
      .eq('id', signalId);
    if (error) {
      addBreadcrumb('updateSignalOutcome failed', { error: error.message });
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Load recent signals for a symbol+timeframe, newest first.
 * Returns empty array if Supabase is not configured.
 */
export async function loadRecentSignals(
  symbolId: string,
  timeframe: Timeframe,
  limit: number,
): Promise<Signal[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('symbol_id', symbolId)
      .eq('timeframe', timeframe)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      addBreadcrumb('loadRecentSignals failed', { error: error.message });
      return [];
    }
    if (!data || data.length === 0) return [];
    return (data as SignalRow[]).map(rowToSignal);
  } catch {
    return [];
  }
}


/**
 * Delete every row from trading_signals — used when the user explicitly
 * clears the signal history from the sidebar ("Удалить всё"). Unlike
 * saveSignal/updateSignalOutcome (per-signal, id-scoped), this wipes the
 * whole table: the sidebar history is not filtered by symbol/timeframe, so
 * a partial (symbol-scoped) delete would leave rows behind that the user
 * already saw removed from the UI, silently resurrecting them the moment
 * anything ever reads trading_signals back (e.g. a future loadRecentSignals
 * call). Silently does nothing if Supabase is not configured — same
 * fallback contract as every other function in this module.
 *
 * Аудит, п.3 (security): раньше это был прямой `.delete()` анонимным
 * ключом (anon-политика DELETE на trading_signals). Anon-ключ встроен в
 * клиентский бандл и публично виден в каждом сетевом запросе — то есть
 * ЛЮБОЙ, кто его скопировал, мог одним запросом мгновенно стереть общую
 * историю сигналов для всех пользователей деплоя, без ограничения частоты.
 * Теперь массовое удаление проксируется через edge-функцию
 * `delete-all-signals`, которая сама выполняет DELETE service-role ключом
 * на сервере (anon-ключ такого права больше не имеет — см. миграцию
 * 20260828_lock_down_signals_and_calibration_delete.sql) и ограничена
 * rate-limit'ом (см. supabase/functions/delete-all-signals/index.ts).
 */
export async function deleteAllSignals(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELETE_PROXY_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${url}/functions/v1/delete-all-signals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
          'X-Client-Key': getClientId(),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
      addBreadcrumb('deleteAllSignals failed', { error: body.error ?? `HTTP ${res.status}` });
    }
  } catch (err) {
    // Non-fatal: local/in-memory history is still cleared by the caller
    // even if the DB delete fails.
    addBreadcrumb('deleteAllSignals failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Save calibration state (weights, bias, samples) to the database.
 */
export async function saveCalibrationState(
  state: CalibrationState,
  samples: CalibrationSample[],
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('calibration_state')
      .upsert({
        id: CALIBRATION_ROW_ID,
        weights: state.weights,
        bias: state.bias,
        sample_count: state.sampleCount,
        samples: samples as unknown as Record<string, unknown>,
      });
    if (error) {
      addBreadcrumb('saveCalibrationState failed', { error: error.message });
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Load calibration state from the database.
 * Returns null if Supabase is not configured or no state exists.
 */
export async function loadCalibrationStateFromDb(): Promise<{
  state: CalibrationState;
  samples: CalibrationSample[];
} | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('calibration_state')
      .select('weights, bias, sample_count, samples')
      .eq('id', CALIBRATION_ROW_ID)
      .maybeSingle();
    if (error) {
      addBreadcrumb('loadCalibrationStateFromDb failed', { error: error.message });
      return null;
    }
    if (!data) return null;
    return {
      state: {
        weights: data.weights as number[],
        bias: data.bias as number,
        sampleCount: data.sample_count as number,
      },
      samples: Array.isArray(data.samples) ? (data.samples as CalibrationSample[]) : [],
    };
  } catch {
    return null;
  }
}
