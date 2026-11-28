import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Asks a sender to send what is waiting: when the screen opens, every so often while it is open, and whenever the app
 * comes back to the front. The sender itself makes sure only one send runs at a time, so asking too often is harmless.
 */
export function useFlushLoop(flush: () => Promise<unknown>, options: { everyMs?: number; enabled?: boolean } = {}): void {
  const { everyMs = 30_000, enabled = true } = options;
  const latest = useRef(flush);
  latest.current = flush;

  useEffect(() => {
    if (!enabled) return undefined;
    const run = () => {
      latest.current().catch(() => undefined);
    };
    run();
    const timer = setInterval(run, everyMs);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') run();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [everyMs, enabled]);
}
