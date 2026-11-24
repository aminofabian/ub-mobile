import { LOADING, loadedFailure, loadedFromRead, type Loaded } from './loaded';

/**
 * The rules for reading one thing again and again, apart from the screen that shows it:
 *
 * - the newest read wins. An older read that comes back late never replaces a newer answer;
 * - a read that fails keeps what was read before, marked old (see `loadedFailure`), and says nothing new when there was
 *   nothing before;
 * - what was held belongs to what was being read. When that changes (`reset`), it is dropped, and a read still on its
 *   way for the old thing is ignored;
 * - when the screen is gone (`stop`), nothing more is published.
 */
export type Loader<T> = {
  /** Reads once now and publishes the answer. Resolves when this read is settled, whatever it found. Never rejects. */
  reload: () => Promise<void>;
  /** Drops what was held and publishes "loading". A read still on its way is ignored when it comes back. */
  reset: () => void;
  /** Allows answers to be published again (the screen is on). It is on from the start. */
  start: () => void;
  /** No answer is published from now on (the screen is gone). */
  stop: () => void;
};

export function createLoader<T>(read: () => Promise<T | null>, publish: (state: Loaded<T>) => void, enabled: () => boolean = () => true): Loader<T> {
  let held: Loaded<T> = LOADING;
  let latest = 0;
  let stopped = false;
  return {
    async reload() {
      if (stopped || !enabled()) return;
      latest += 1;
      const mine = latest;
      let next: Loaded<T>;
      try {
        next = loadedFromRead(await read(), held);
      } catch (error) {
        next = loadedFailure(error, held);
      }
      if (mine !== latest || stopped) return;
      held = next;
      publish(next);
    },
    reset() {
      latest += 1;
      held = LOADING;
      if (!stopped) publish(LOADING);
    },
    start() {
      stopped = false;
    },
    stop() {
      stopped = true;
    },
  };
}
