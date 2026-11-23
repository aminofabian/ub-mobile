import { parseHoldBook, serializeHoldBook, type HoldBook, type ParsedBook } from './holds';

/** Where the held baskets are kept: one piece of text per shop. */
export interface HoldStorage {
  read: () => Promise<string | null>;
  /** False when nothing owns the data (no shop to keep it for). A failure to write rejects. */
  write: (value: string) => Promise<boolean>;
}

export interface HoldKeeper {
  /**
   * The baskets on the phone. A failure to read rejects, and must never be taken for "none": a book that failed to
   * load and was then saved over would throw away every basket on the phone.
   */
  load: (now: number) => Promise<ParsedBook>;
  /**
   * Keeps the book. Saves never overlap and the last one asked for is the last one written, however slowly the
   * earlier ones finish. Answers whether the last write landed.
   */
  save: (book: HoldBook) => Promise<boolean>;
}

export function createHoldKeeper(storage: HoldStorage): HoldKeeper {
  let pending: HoldBook | null = null;
  let running: Promise<boolean> | null = null;

  async function drain(): Promise<boolean> {
    let landed = true;
    try {
      while (pending) {
        const next = pending;
        pending = null;
        try {
          landed = await storage.write(serializeHoldBook(next));
        } catch {
          landed = false;
        }
      }
    } finally {
      running = null;
    }
    return landed;
  }

  return {
    load: async (now) => parseHoldBook(await storage.read(), now),
    save: (book) => {
      pending = book;
      running ??= drain();
      return running;
    },
  };
}
