/**
 * Keeps one piece of a shop's data on the phone: the sale being rung up at the grocery counter, the stock take being
 * counted. The data lives in memory while the app runs, so every screen sees the same copy, and is written down after
 * each change, so a closed app or a flat battery loses nothing.
 *
 * Two rules the Cashier learned the hard way (its held baskets):
 *  - A read that FAILED is never taken for "nothing there". If the data could not be read and the app then saved over
 *    it, everything kept would be thrown away. So a keeper refuses changes until a read has worked.
 *  - Saves never overlap, and the last one asked for is the last one written, however slowly the earlier ones finish.
 */

export interface KeeperStorage {
  read: () => Promise<string | null>;
  /** Writes the text, or removes what is kept when the value is null. Answers whether it landed. A failure may reject. */
  write: (value: string | null) => Promise<boolean>;
}

export interface Keeper<T> {
  /** Reads what is kept (once; later calls answer from memory). A failure to read rejects and leaves the keeper unloaded. */
  load: (now: number) => Promise<T>;
  get: () => T;
  isLoaded: () => boolean;
  /** Changes the data and writes it down. Throws before the first successful `load`. Returning the same value changes nothing. */
  update: (change: (current: T) => T) => T;
  subscribe: (listener: () => void) => () => void;
  /** Settles when every write asked for so far has finished. Answers whether the last one landed. */
  saved: () => Promise<boolean>;
}

export function createKeeper<T>(options: {
  initial: T;
  parse: (text: string | null, now: number) => T;
  /** The text to keep, or null when there is nothing worth keeping (the stored value is then removed). */
  serialize: (state: T) => string | null;
  storage: KeeperStorage;
}): Keeper<T> {
  const { initial, parse, serialize, storage } = options;
  let state = initial;
  let loaded = false;
  let loading: Promise<T> | null = null;
  let queued: { text: string | null } | null = null;
  let running: Promise<boolean> | null = null;
  let lastLanded = true;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // A listener that throws must not stop the others, or the save.
      }
    }
  }

  async function drain(): Promise<boolean> {
    try {
      while (queued) {
        const next = queued;
        queued = null;
        try {
          lastLanded = await storage.write(next.text);
        } catch {
          lastLanded = false;
        }
      }
    } finally {
      running = null;
    }
    return lastLanded;
  }

  return {
    load(now) {
      if (loaded) return Promise.resolve(state);
      loading ??= storage.read().then(
        (text) => {
          loading = null;
          // A change made while the read was on its way cannot happen (update refuses), so this is the first state.
          state = parse(text, now);
          loaded = true;
          notify();
          return state;
        },
        (error: unknown) => {
          loading = null;
          throw error;
        }
      );
      return loading;
    },
    get: () => state,
    isLoaded: () => loaded,
    update(change) {
      if (!loaded) throw new Error('What is kept on this phone has not been read yet.');
      const next = change(state);
      if (next === state) return state;
      // Worked out before the state is replaced: a value that cannot be written down is not kept in memory either.
      const text = serialize(next);
      state = next;
      queued = { text };
      running ??= drain();
      notify();
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    saved: () => running ?? Promise.resolve(lastLanded),
  };
}
