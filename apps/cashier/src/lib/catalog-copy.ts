import { isApiError } from '@kiosk/core';
import type { CartItem } from './cart';
import {
  CATALOG_MAX_ROWS,
  encodeCatalog,
  openCatalog,
  parseCatalog,
  shouldRefresh,
  type Catalog,
  type OpenCatalog,
} from './catalog';
import { isNoAnswer } from './reach';
import { withTimeout } from './with-timeout';

/** One page of the shop's list, already reduced to what the till can sell. */
export interface CatalogPage {
  items: CartItem[];
  /** How many rows the server sent, sellable or not: the page is the last when it is short. */
  seen: number;
  /** The server said this is the last page. Null when it did not say. */
  last: boolean | null;
  /** How many rows the shop's list has in all, when the server said. */
  total: number | null;
}

/** How many rows are asked for at a time. Small enough that one slow page does not lose much. */
export const PAGE_SIZE = 250;
/** The most pages one copy reads: `PAGE_SIZE` times this is more than the phone keeps. */
export const MAX_PAGES = Math.ceil(CATALOG_MAX_ROWS / PAGE_SIZE) + 20;
/** How long one page may take. */
export const PAGE_WAIT_MS = 25_000;
/** How long to wait before asking a page again, after each failed try. Three tries in all. */
export const PAGE_RETRY_WAITS_MS = [1_000, 3_000] as const;

/** The shop sent a list with nothing on it that can be sold. A copy of that would only hide the real list. */
export class NothingToSell extends Error {
  constructor() {
    super('The shop sent no products that can be sold.');
    this.name = 'NothingToSell';
  }
}

/** A page did not come in time. */
export class PageTimedOut extends Error {
  constructor() {
    super('The server did not send the price list in time.');
    this.name = 'PageTimedOut';
  }
}

export interface Scanned {
  /** Rows read so far, sellable or not. */
  scanned: number;
  total: number | null;
}

/**
 * Reads the whole list, a page at a time, and stops at the end of it. A page that fails is asked again, twice, when
 * nobody answered or the server broke; a refusal is not asked again. Any page that cannot be had fails the whole read:
 * half a list is never given as a list. A product on two pages (the list moved while it was read) is kept once.
 */
export async function readAll(options: {
  fetchPage: (page: number, size: number) => Promise<CatalogPage>;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (progress: Scanned) => void;
  pageWaitMs?: number;
}): Promise<{ items: CartItem[]; cut: boolean }> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const waitMs = options.pageWaitMs ?? PAGE_WAIT_MS;
  const seen = new Set<string>();
  const items: CartItem[] = [];
  let scanned = 0;

  async function pageWithRetries(page: number): Promise<CatalogPage> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await withTimeout(() => options.fetchPage(page, PAGE_SIZE), waitMs, () => new PageTimedOut());
      } catch (error) {
        const again = isNoAnswer(error) || (isApiError(error) && error.status >= 500);
        const wait = PAGE_RETRY_WAITS_MS[attempt];
        if (!again || wait === undefined) throw error;
        await sleep(wait);
      }
    }
  }

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const got = await pageWithRetries(page);
    for (const item of got.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    }
    scanned += got.seen;
    options.onProgress?.({ scanned, total: got.total });
    const end = got.last === true || got.seen === 0 || (got.last === null && got.seen < PAGE_SIZE);
    if (end) {
      if (items.length === 0) throw new NothingToSell();
      return { items, cut: false };
    }
    if (items.length >= CATALOG_MAX_ROWS) return { items, cut: true };
  }
  if (items.length === 0) throw new NothingToSell();
  return { items, cut: true };
}

/** Why the last try to make a copy came to nothing. */
export type CopyFailure = 'no_answer' | 'refused' | 'nothing' | 'other';

export function failureOf(error: unknown): CopyFailure {
  if (error instanceof NothingToSell) return 'nothing';
  if (isNoAnswer(error)) return 'no_answer';
  if (isApiError(error)) return error.status >= 500 ? 'no_answer' : 'refused';
  return 'other';
}

export interface CopyState {
  /** The phone has been read for a copy. Until then nothing is known, and nothing is made. */
  loaded: boolean;
  /** The copy that can be searched: the phone's, for this branch. */
  open: OpenCatalog | null;
  /** What the phone holds, for any branch (null when nothing readable). */
  stored: Catalog | null;
  /** What was found in storage instead of a copy. `newer`: written by a later app. */
  found: 'nothing' | 'unreadable' | 'newer' | 'copy';
  /** The copy in use is on the phone, not only in memory. */
  saved: boolean;
  /** A copy is being made: how far it has got. */
  making: Scanned | null;
  /** The last try that failed, and when. Cleared by the next one that works. */
  failure: { at: number; why: CopyFailure } | null;
}

export const NO_COPY: CopyState = {
  loaded: false,
  open: null,
  stored: null,
  found: 'nothing',
  saved: false,
  making: null,
  failure: null,
};

export interface CopyDeps {
  /** The text kept on the phone for this shop, or null. Fails when the phone cannot be read. */
  read: () => Promise<string | null>;
  /** Keeps the text. False (or a failure) when it could not be kept. */
  write: (text: string) => Promise<boolean>;
  fetchPage: (page: number, size: number) => Promise<CatalogPage>;
  branchId: string;
  now: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Whether the line to the server is believed to be down. */
  offline: () => boolean;
}

export interface CatalogCopy {
  state(): CopyState;
  subscribe(listener: () => void): () => void;
  /** Reads what the phone holds. Safe to call again: it reads once. */
  load(): Promise<void>;
  /** Makes a copy now, from the shop, and keeps it. Resolves when the try is over; never throws. */
  make(): Promise<void>;
  /** Makes a copy if one is due (see `shouldRefresh`). */
  makeIfDue(): Promise<void>;
}

/**
 * One shop's, one branch's copy of the price list: what is on the phone, what is being made, what went wrong. It is
 * the only thing that reads or writes the text, so two tries never overlap. A copy that cannot be made leaves the one
 * there was exactly as it was.
 */
export function createCatalogCopy(deps: CopyDeps): CatalogCopy {
  let state: CopyState = NO_COPY;
  const listeners = new Set<() => void>();
  let loading: Promise<void> | null = null;
  let making: Promise<void> | null = null;

  const set = (next: Partial<CopyState>) => {
    state = { ...state, ...next };
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // A listener that throws must not stop the others.
      }
    }
  };

  const usable = (catalog: Catalog | null): OpenCatalog | null =>
    catalog && catalog.branchId === deps.branchId ? openCatalog(catalog) : null;

  async function readPhone(): Promise<void> {
    try {
      const text = await deps.read();
      const read = parseCatalog(text, deps.now());
      if (read.kind === 'copy') {
        set({ loaded: true, stored: read.catalog, open: usable(read.catalog), found: 'copy', saved: true });
      } else {
        set({ loaded: true, stored: null, open: null, found: read.kind === 'none' ? 'nothing' : read.kind, saved: false });
      }
    } catch {
      // The phone could not be read. That is not "no copy": nothing is made over what may be there.
      set({ loaded: false });
    }
  }

  async function makeCopy(): Promise<void> {
    set({ making: { scanned: 0, total: null } });
    try {
      const { items, cut } = await readAll({
        fetchPage: deps.fetchPage,
        ...(deps.sleep ? { sleep: deps.sleep } : {}),
        onProgress: (progress) => set({ making: progress }),
      });
      const at = deps.now();
      const encoded = encodeCatalog({ branchId: deps.branchId, at, items, cut });
      const read = parseCatalog(encoded.text, at);
      if (read.kind !== 'copy') throw new NothingToSell();
      let saved = false;
      try {
        saved = await deps.write(encoded.text);
      } catch {
        saved = false;
      }
      set({
        stored: read.catalog,
        open: usable(read.catalog),
        found: 'copy',
        saved,
        making: null,
        failure: null,
      });
    } catch (error) {
      set({ making: null, failure: { at: deps.now(), why: failureOf(error) } });
    }
  }

  function load(): Promise<void> {
    if (state.loaded) return Promise.resolve();
    if (!loading) {
      loading = readPhone().finally(() => {
        loading = null;
      });
    }
    return loading;
  }

  async function make(): Promise<void> {
    await load();
    // Nothing is made until the phone has been read: a copy made over one that could not be read would lose it.
    if (!state.loaded) return;
    if (!making) {
      making = makeCopy().finally(() => {
        making = null;
      });
    }
    return making;
  }

  async function makeIfDue(): Promise<void> {
    await load();
    if (!state.loaded) return;
    const due = shouldRefresh({
      catalog: state.stored,
      branchId: deps.branchId,
      now: deps.now(),
      offline: deps.offline(),
      busy: making !== null,
      failedAt: state.failure?.at ?? null,
    });
    if (due) await make();
  }

  return {
    state: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load,
    make,
    makeIfDue,
  };
}
