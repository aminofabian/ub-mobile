import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/** What a screen needs of a keeper (see `createKeeper` in `@kiosk/core`). */
export interface KeptSource<T> {
  load: (now: number) => Promise<T>;
  get: () => T;
  isLoaded: () => boolean;
  subscribe: (listener: () => void) => () => void;
}

export type Kept<T> = {
  value: T;
  /** What is kept on the phone has been read. Until then the value is the empty one, and changes are refused. */
  ready: boolean;
  /** Reading what is kept failed. It must not be taken for "nothing kept": try again. */
  failed: boolean;
  retry: () => void;
};

/**
 * What a keeper holds, as a screen reads it. Reads it from the phone once, then follows every change, whichever screen
 * made it. A failed read is reported, never turned into an empty list.
 */
export function useKept<T>(keeper: KeptSource<T>): Kept<T> {
  const value = useSyncExternalStore(keeper.subscribe, keeper.get, keeper.get);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(keeper.isLoaded() ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (keeper.isLoaded()) {
      setState('ready');
      return undefined;
    }
    let live = true;
    setState('loading');
    keeper.load(Date.now()).then(
      () => {
        if (live) setState('ready');
      },
      () => {
        if (live) setState('failed');
      }
    );
    return () => {
      live = false;
    };
  }, [keeper, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { value, ready: state === 'ready', failed: state === 'failed', retry };
}
