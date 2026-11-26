import { useEffect, useState } from 'react';

/**
 * The time now, read again every so often, so words such as "waiting for a long time" or "expires in 5 min" stay true
 * while a screen stays open.
 */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
