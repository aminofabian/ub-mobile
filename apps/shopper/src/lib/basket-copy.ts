/**
 * The words the screens use about the basket's state, kept in one place so the cart, the checkout and the
 * floating bar say the same thing. No imports of the app, so node can run this file's test directly.
 */
import type { BasketView, NotReady } from './basket';
import type { NotOrderable } from './checkout-run';

/** The total as shown: the shop's figure plainly, the phone's reckoning with a "≈", and nothing when not known. */
export function totalText(view: BasketView, format: (currency: string, amount: number) => string): string | null {
  if (view.subtotal === null) return null;
  return `${view.isEstimate ? '≈ ' : ''}${format(view.currency, view.subtotal)}`;
}

export interface SyncNoteInput {
  waiting: boolean;
  offline: boolean;
  /** How many lines the shop would not take. */
  refused: number;
}

/** One line under the basket about whether the shop has heard it, or null when there is nothing to say. */
export function syncNote({ waiting, offline, refused }: SyncNoteInput): string | null {
  if (refused > 0) return refused === 1 ? 'The shop could not take 1 item. See below.' : `The shop could not take ${refused} items. See below.`;
  if (offline && waiting) return 'No signal. Your basket is kept on this phone and goes to the shop when you are back online.';
  if (waiting) return 'Updating with the shop…';
  return null;
}

/** Why an order cannot be placed from the basket yet. */
export function notReadyText(why: NotOrderable): string {
  switch (why) {
    case 'unreachable':
      return 'We could not reach the shop to check your basket. Check your signal and try again.';
    case 'empty':
      return 'Your basket is empty. Add something, then place the order.';
    case 'waiting':
      return 'Your basket has not reached the shop yet. Check your signal and try again.';
    case 'refused':
      return 'The shop could not take something in your basket. Open your basket to fix it.';
    case 'unpriced':
      return 'The shop has not priced something in your basket yet. Open your basket to take it out.';
    default:
      return 'Your basket was not ready at the shop. Try again.';
  }
}
