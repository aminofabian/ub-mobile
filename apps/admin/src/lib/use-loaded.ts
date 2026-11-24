import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { createLoader } from './loader';
import { LOADING, type Loaded } from './loaded';

export type LoadedHandle<T> = {
  loaded: Loaded<T>;
  /** A pull to refresh is under way. */
  refreshing: boolean;
  /** Reads again now. Resolves when the answer is in. */
  reload: () => Promise<void>;
  /** Reads again for a pull to refresh, and shows it while it goes. */
  refresh: () => Promise<void>;
};

/**
 * Reads one thing from the server whenever the screen comes into view, and every `everyMs` while it is, by the rules
 * in `createLoader`. With `enabled` false nothing is read: a part the person's role cannot see costs no request.
 *
 * `key` names what is being read (which list, which search). When it changes, what was held belongs to something else,
 * so it is dropped and the new thing is read at once.
 */
export function useLoaded<T>(read: () => Promise<T | null>, everyMs: number | null = null, enabled = true, key = ''): LoadedHandle<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>(LOADING);
  const [refreshing, setRefreshing] = useState(false);
  const readRef = useRef(read);
  const enabledRef = useRef(enabled);
  const keyRef = useRef(key);
  const [loader] = useState(() => createLoader<T>(() => readRef.current(), setLoaded, () => enabledRef.current));

  useEffect(() => {
    readRef.current = read;
    enabledRef.current = enabled;
  });

  useEffect(() => {
    loader.start();
    return () => loader.stop();
  }, [loader]);

  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    loader.reset();
    void loader.reload();
  }, [key, loader]);

  const reload = loader.reload;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loader.reload();
    } finally {
      setRefreshing(false);
    }
  }, [loader]);

  useFocusEffect(
    useCallback(() => {
      void loader.reload();
      if (everyMs === null) return undefined;
      const timer = setInterval(() => void loader.reload(), everyMs);
      return () => clearInterval(timer);
    }, [loader, everyMs])
  );

  return { loaded, refreshing, reload, refresh };
}
