import { useEffect, useState } from 'react';
import { Timer, AlertTriangle, Moon } from 'lucide-react';
import { useTickStore } from '@/stores/useTickStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { TIMEFRAME_SECONDS } from '@/data/symbols';
import { serverClock } from '@/data/server-clock';
import { clsx } from '@/lib/utils';
import { PRE_CLOSE_SIGNAL_LEAD_MS } from '@/lib/constants';

export function CandleTimer() {
  const symbolId = useSettingsStore((s) => s.symbolId);
  const timeframe = useSettingsStore((s) => s.timeframe);
  const candleLifecycle = useTickStore((s) => s.candleLifecycle);
  const marketClosed = useTickStore((s) => s.marketClosed);
  const [nowMs, setNowMs] = useState(serverClock.now());

  useEffect(() => {
    return serverClock.onTick((t) => setNowMs(t));
  }, []);

  if (!symbolId) return null;

  const tfMs = TIMEFRAME_SECONDS[timeframe] * 1000;
  const tfSec = TIMEFRAME_SECONDS[timeframe];

  const currentPeriodOpen = Math.floor(nowMs / tfMs) * tfSec;
  const currentPeriodCloseMs = (currentPeriodOpen + tfSec) * 1000;
  const remainingMs = currentPeriodCloseMs - nowMs;
  const elapsedInCycle = ((nowMs % tfMs) + tfMs) % tfMs;
  const remaining = Math.max(0, Math.min(remainingMs, tfMs));
  const isPreClose = remaining > 0 && remaining <= PRE_CLOSE_SIGNAL_LEAD_MS;
  const progress = elapsedInCycle / tfMs;

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const isStale = !marketClosed && candleLifecycle === 'stale';

  return (
    <span className="flex items-center gap-1 rounded-md bg-base-800/60 px-1.5 py-1">
      <Timer
        size={13}
        className={clsx(
          isPreClose ? 'text-warning-400 animate-pulse' : 'text-secondary-400',
          marketClosed && 'text-accent-400',
          isStale && 'text-warning-400',
        )}
      />
      <div className="flex flex-col">
        <span className="hidden text-3xs font-medium leading-none text-base-500 sm:inline">Свеча</span>
        <span
          className={clsx(
            'font-mono text-sm font-bold leading-tight tabular-nums',
            isPreClose ? 'text-warning-400' : 'text-base-100',
            marketClosed && 'text-accent-400',
            isStale && 'text-warning-400',
          )}
        >
          {display}
        </span>
      </div>
      <span className="relative h-1.5 w-11 overflow-hidden rounded-full bg-base-800">
        <span
          className={clsx(
            'absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-linear',
            isPreClose ? 'bg-warning-400' : 'bg-secondary-500',
            marketClosed && 'bg-accent-500',
            isStale && 'bg-warning-500',
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </span>
      {marketClosed && (
        <span className="hidden items-center gap-0.5 text-3xs font-bold text-accent-400 sm:flex">
          <Moon size={10} />
          Рынок закрыт
        </span>
      )}
      {isStale && (
        <span className="hidden items-center gap-0.5 text-3xs font-bold text-warning-400 sm:flex">
          <AlertTriangle size={10} />
          Нет данных
        </span>
      )}
    </span>
  );
}
