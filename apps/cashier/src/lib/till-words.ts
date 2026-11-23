import { isApiError } from '@kiosk/core';
import { MAX_UNITS } from './cart';
import { MAX_HELD, MAX_HELD_LINES, type HoldResult, type ParsedBook } from './holds';
import { formatKg, MAX_WEIGHT_THOUSANDTHS } from './weight';

/** What to tell the cashier when the products could not be loaded. */
export function describeItemsFailure(error: unknown): string {
  if (isApiError(error) && error.status === 403) {
    return 'Your role is not allowed to look up products. Ask the owner to allow it.';
  }
  return 'Could not load products. Check the connection and try again.';
}

/** Why a basket was not put on hold. Empty when it was. */
export function holdRefusalWords(result: HoldResult): string {
  if (result.ok) return '';
  switch (result.reason) {
    case 'full':
      return `You already hold ${MAX_HELD} baskets. Finish or throw one away first.`;
    case 'big':
      return `A basket on hold can have ${MAX_HELD_LINES} items at most. Take some out, or finish this sale first.`;
    case 'empty':
      return 'Add something to the basket first.';
  }
}

/** Said when the held baskets could not be written to the phone: they are held, but only until the app closes. */
export const HOLD_NOT_SAVED =
  'The held baskets could not be saved on this phone. They are kept until the app closes, and then they are lost.';

/** What to tell the cashier about held baskets that were not kept when they were read from the phone. Empty when all were. */
export function describeLoadedHolds(parsed: Pick<ParsedBook, 'expired' | 'damaged'>): string[] {
  const notes: string[] = [];
  if (parsed.expired > 0) {
    notes.push(
      parsed.expired === 1
        ? 'A held basket was over a day old and was removed.'
        : `${parsed.expired} held baskets were over a day old and were removed.`
    );
  }
  if (parsed.damaged > 0) {
    notes.push(
      parsed.damaged === 1
        ? 'A held basket could not be read and was removed.'
        : `${parsed.damaged} held baskets could not be read and were removed.`
    );
  }
  return notes;
}

/** Said when the held baskets could not be read from the phone: nothing may be held until they can be. */
export const HOLDS_NOT_READ =
  'The held baskets could not be read from this phone, so holding a basket is switched off until they can be. Close and open the app to try again.';

/** Said when picking a basket up was refused. */
export const RECALL_REFUSED =
  `That basket could not be picked up. It may be gone, or you may already hold ${MAX_HELD} baskets: finish or throw one away first.`;

/** Why one more of a counted item, or more weight of a weighed one, was refused (the item itself can be sold). */
export function describeAddRefusal(weighed: boolean): string {
  return weighed
    ? `One line cannot weigh more than ${formatKg(MAX_WEIGHT_THOUSANDTHS)}.`
    : `One line cannot be more than ${MAX_UNITS.toLocaleString('en-US')} of an item.`;
}
