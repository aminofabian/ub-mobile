import type { CopyFailure, CopyState } from './catalog-copy';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * When a copy was made, in the phone's own time and the words a person says it in: "as of 14:02 today", "as of 17:40
 * yesterday", "as of 21 Nov, 09:15". A copy whose time is not known says so.
 */
export function asOfWords(at: number, now: number): string {
  if (!Number.isFinite(at) || at <= 0) return 'as of a time that is not known';
  const then = new Date(at);
  const today = new Date(now);
  if (sameDay(then, today)) return `as of ${clock(then)} today`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (sameDay(then, yesterday)) return `as of ${clock(then)} yesterday`;
  return `as of ${then.getDate()} ${MONTHS[then.getMonth()]}, ${clock(then)}`;
}

function products(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'product' : 'products'}`;
}

/** Said above the list when it is the phone's own copy that answered. Prices and stock are the copy's, and may have moved. */
export function fromPhoneWords(asOf: number, now: number, cut: boolean): string {
  const base = `No connection. These prices and stock are from the list saved on this phone, ${asOfWords(asOf, now)}. They may have changed.`;
  return cut ? `${base} Some products are not on the phone's list, so they cannot be found here.` : base;
}

/** On the Payment screen when some of the prices in the sale came from the list saved on this phone. */
export function priceAgeCaption(asOf: number, now: number): string {
  return `Some prices in this sale are from the list saved on this phone, ${asOfWords(asOf, now)}. If the shop has changed one since, the server may not accept the sale when it is sent, and a manager will have to look at it.`;
}

/** Said when the shop cannot be reached and the phone has no list to use. */
export const NO_PRICE_LIST_WORDS =
  'No connection, and this phone has no price list saved yet. Connect to the internet once and the list is saved here for next time.';

/** Said when a list was found on the phone that it cannot use. */
export function whyNoCopy(found: CopyState['found']): string | null {
  switch (found) {
    case 'unreadable':
      return 'The price list saved on this phone could not be read, so it will be saved again.';
    case 'newer':
      return 'The price list saved on this phone was made by a newer version of the app, so it will be saved again.';
    default:
      return null;
  }
}

function failureWords(why: CopyFailure): string {
  switch (why) {
    case 'no_answer':
      return 'Could not save the price list just now: there is no connection to the shop. It tries again by itself.';
    case 'refused':
      return 'The shop did not give this phone its price list. Ask the owner whether your role may look products up.';
    case 'nothing':
      return 'The shop sent no products that can be sold, so the price list was not saved.';
    case 'other':
      return 'Could not save the price list just now. It tries again by itself.';
  }
}

/**
 * The one line under the search box about the list kept on the phone. Empty when there is nothing to say: the list is
 * there and fresh enough, and nothing went wrong.
 */
export function copyLine(state: CopyState, now: number): string {
  if (state.making) {
    const { scanned, total } = state.making;
    if (total !== null && total > 0) {
      return `Saving the price list on this phone: ${Math.min(scanned, total).toLocaleString('en-US')} of ${total.toLocaleString('en-US')}...`;
    }
    return 'Saving the price list on this phone...';
  }
  if (state.failure) {
    const words = failureWords(state.failure.why);
    return state.open ? `${words} The list saved earlier is still here, ${asOfWords(state.open.at, now)}.` : words;
  }
  if (!state.loaded) return '';
  if (!state.open) return whyNoCopy(state.found) ?? 'No price list is saved on this phone yet.';
  const parts = [`Price list on this phone: ${products(state.open.items.length)}, ${asOfWords(state.open.at, now)}.`];
  if (state.open.cut) parts.push("The shop has more products than the phone keeps, so some are not on it.");
  if (!state.saved) parts.push('It is kept only until the app closes.');
  return parts.join(' ');
}

/**
 * The one short line the till shows about its price list — or nothing at all.
 *
 * The old line was a paragraph ("Price list on this phone: 7 products, as of 17:55 today. The shop has more products
 * than the phone keeps…"). A cashier does not read paragraphs between customers: they need the fact at a glance, with
 * the Update button beside it. This says only what is true and worth acting on, and says nothing when all is well.
 */
export function priceListLine(state: CopyState, now: number): { text: string; warn: boolean } | null {
  if (state.making) {
    const { scanned, total } = state.making;
    return {
      text:
        total !== null && total > 0
          ? `Saving the list… ${Math.min(scanned, total).toLocaleString('en-US')}/${total.toLocaleString('en-US')}`
          : 'Saving the list…',
      warn: false,
    };
  }
  if (state.failure) {
    const why = shortFailure(state.failure.why);
    return {
      text: state.open ? `${why} · showing ${clock(new Date(state.open.at))}` : why,
      warn: true,
    };
  }
  if (!state.loaded) return null;
  if (!state.open) return { text: 'No price list on this phone yet', warn: true };
  const count = state.open.items.length.toLocaleString('en-US');
  const at = clock(new Date(state.open.at));
  if (state.open.cut) return { text: `${count} products · some not on this phone`, warn: true };
  if (!state.saved) return { text: `${count} products · ${at} · kept until the app closes`, warn: true };
  // Everything is in order: the pull-to-refresh gesture is the affordance, not a line of text.
  return null;
}

/** A failure in three or four words, for the line beside the Update button. */
function shortFailure(why: CopyFailure): string {
  switch (why) {
    case 'no_answer':
      return 'No connection';
    case 'refused':
      return 'The shop refused the list';
    case 'nothing':
      return 'The shop sent no products';
    case 'other':
      return 'Could not save the list';
  }
}

/**
 * The compact form for the top of the till on a normal day: "7 items · 08:36", with nothing to
 * explain. When the list is doing something a cashier should read — saving, failing, cut short,
 * kept only in memory, or not there at all — this returns null and the caller falls back to the full
 * {@link copyLine}, so no warning is ever hidden behind the short form.
 */
export function compactCopyLine(state: CopyState, now: number): string | null {
  if (state.making || state.failure || !state.loaded || !state.open) return null;
  if (state.open.cut || !state.saved) return null;
  return `${state.open.items.length.toLocaleString('en-US')} items · ${clock(new Date(state.open.at))}`;
}

