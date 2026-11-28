/**
 * Where the basket lives while the app runs, and how it reaches the phone's storage.
 *
 * One store for a shop, shared by every screen that shows or changes the basket, so a tap in one place is
 * seen in the others at once. A change made before the saved basket has been read is not lost: it waits and
 * is applied to what was saved. Every change is written back, one write at a time, the latest last.
 *
 * Imports only the basket rules, so node can run this file's test directly.
 */
import { emptyBasket, parseBasket, serializeBasket, type Basket } from './basket';

export interface BasketStore {
  get(): Basket;
  /** Whether the saved basket has been read. */
  isLoaded(): boolean;
  subscribe(listener: () => void): () => void;
  update(change: (basket: Basket) => Basket): void;
  /** Resolves when the saved basket has been read and every change so far has been written. */
  settled(): Promise<void>;
  /**
   * The shop was taken off the phone. From now on a change is ignored and nothing is written, so an answer
   * that arrives late cannot put the basket back on the phone after it was removed.
   */
  close(): void;
  isClosed(): boolean;
}

export interface BasketStorage {
  read(): Promise<string | null>;
  write(raw: string): Promise<void>;
}

export function createBasketStore(storage: BasketStorage, now: () => Date): BasketStore {
  let state = emptyBasket(now());
  let loaded = false;
  let closed = false;
  const waiting: Array<(basket: Basket) => Basket> = [];
  const listeners = new Set<() => void>();
  let writes: Promise<void> = Promise.resolve();

  const tell = () => {
    for (const listener of [...listeners]) listener();
  };
  const save = () => {
    const raw = serializeBasket(state);
    writes = writes.then(() => (closed ? undefined : storage.write(raw))).catch(() => undefined);
  };

  const ready = storage
    .read()
    .then((raw) => parseBasket(raw, now()))
    .catch(() => emptyBasket(now()))
    .then((saved) => {
      state = saved;
      loaded = true;
      for (const change of waiting.splice(0)) state = change(state);
      tell();
      save();
    });

  return {
    get: () => state,
    isLoaded: () => loaded,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    update(change) {
      if (closed) return;
      if (!loaded) {
        waiting.push(change);
        return;
      }
      state = change(state);
      tell();
      save();
    },
    settled: async () => {
      await ready;
      await writes;
    },
    close() {
      closed = true;
      waiting.length = 0;
      listeners.clear();
    },
    isClosed: () => closed,
  };
}
