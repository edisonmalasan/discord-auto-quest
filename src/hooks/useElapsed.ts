import { useEffect, useState } from 'react';

/**
 * How long ago a quest started, as a running clock.
 *
 * The figure is a measurement, so it is set in tabular numerals by the caller. The
 * clock ticks once a second, which is as often as a person reads it.
 */
export function useElapsed(startedAt: number | null): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  if (startedAt === null) {
    return '';
  }

  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - startedAt);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  const padded = (value: number) => value.toString().padStart(2, '0');

  return hours > 0
    ? `${hours}:${padded(minutes)}:${padded(rest)}`
    : `${padded(minutes)}:${padded(rest)}`;
}
