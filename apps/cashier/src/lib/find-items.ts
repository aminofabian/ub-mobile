import { classifyReplayFailure } from '@kiosk/offline';
import type { CartItem } from './cart';
import { findByBarcode, searchCatalog, type OpenCatalog } from './catalog';
import { isNoAnswer } from './reach';
import { withTimeout } from './with-timeout';

/** The search ran out of time. It is "no answer", like a line with nothing behind it. */
export class SearchTimedOut extends Error {
  constructor() {
    super('The server did not answer the search in time.');
    this.name = 'SearchTimedOut';
  }
}

/** The shop cannot be reached, and the phone has no list of its own to use instead. */
export class NoPriceList extends Error {
  constructor() {
    super('There is no connection, and this phone has no price list saved yet.');
    this.name = 'NoPriceList';
  }
}

/** Where the products on screen came from. */
export type Found =
  /** The shop answered. These are its prices, now. */
  | { from: 'shop'; items: CartItem[] }
  /** The shop could not be asked: these are the phone's copy of the list, as of `asOf`. */
  | { from: 'phone'; items: CartItem[]; asOf: number; cut: boolean };

export interface Want {
  search?: string;
  barcode?: string;
  /** Only products filed under this category (and its children). Omitted means every category. */
  categoryId?: string;
}

/**
 * Whether the products on screen are read again from the shop: the line has just come back, and what is shown is the
 * phone's own list, or nothing because the list could not be read. Prices on screen must not stay the phone's for as
 * long as the cashier does not search again.
 */
export function reloadAfterReconnect(input: { wasOffline: boolean; offline: boolean; fromPhone: boolean; failed: boolean }): boolean {
  return input.wasOffline && !input.offline && (input.fromPhone || input.failed);
}

/**
 * Finds products for the till. The shop is asked first, and its answer is the answer. Only when nobody answers (no
 * connection, a server with nothing behind it, a search that runs out of time) does the phone's own copy of the list
 * answer instead, and the result says so, with the time the copy was made, so that a price from it is never taken for
 * a live one. A refusal (the role may not look products up) is a real answer and is not hidden by a copy.
 *
 * When the line is already believed down, the shop is not asked at all: the copy answers at once.
 */
export async function findItems(input: {
  want: Want;
  /** The shop's own search. */
  ask: () => Promise<CartItem[]>;
  copy: OpenCatalog | null;
  /** The line to the server is believed to be down. */
  offline: boolean;
  waitMs: number;
  /** A search got no answer. Told, so the till can stop waiting on the line next time. */
  lost?: () => void;
}): Promise<Found> {
  const { want, ask, copy, offline, waitMs, lost } = input;

  const fromPhone = (): Found | null => {
    if (!copy) return null;
    const items = want.barcode !== undefined ? findByBarcode(copy, want.barcode) : searchCatalog(copy, want.search ?? '');
    return { from: 'phone', items, asOf: copy.at, cut: copy.cut };
  };

  if (offline) {
    const own = fromPhone();
    if (own) return own;
    throw new NoPriceList();
  }

  try {
    const items = await withTimeout(ask, waitMs, () => new SearchTimedOut());
    return { from: 'shop', items };
  } catch (error) {
    // Only a search nobody answered (or the server broke on) falls back. A "no" from the server is the answer.
    const how = classifyReplayFailure(error);
    if (how !== 'wait' && how !== 'broken') throw error;
    if (isNoAnswer(error)) lost?.();
    const own = fromPhone();
    if (own) return own;
    throw error;
  }
}
