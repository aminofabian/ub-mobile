import { asSetupRequired, isApiError } from '@kiosk/core';

/** What the till found when it asked the shop whether a shift is open. */
export type ShiftRead = 'open' | 'missing' | 'unknown';

/**
 * Whether the till should stop and open a shift before it sends a sale.
 *
 * Only when the shop said there is no shift. A shop that runs without shifts never asks, and a check that could not
 * be made ("unknown") is not a reason to hold up a sale: the till works offline, and a sale is never blocked by a
 * question it could not get an answer to.
 */
export function mustOpenShift(shiftsDisabled: boolean, read: ShiftRead): boolean {
  return !shiftsDisabled && read === 'missing';
}

/**
 * Whether a refusal from the shop is about a missing shift, in either of the shapes it can arrive: the structured
 * `setup_required` answer, or a plain message that says so in words. The second is a fallback, because a refusal the
 * till cannot recognise leaves the cashier with a sale they cannot finish.
 */
export function refusedForShift(error: unknown): boolean {
  if (asSetupRequired(error)?.requirement === 'shift') return true;
  const said = isApiError(error) ? error.message : error instanceof Error ? error.message : '';
  return /no\s+(open\s+)?shift|shift\s+(is\s+)?(not\s+open|closed|required)|open\s+a\s+shift/i.test(said);
}
