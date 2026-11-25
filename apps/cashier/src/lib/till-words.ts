import { cleanDisplayText, isApiError } from '@kiosk/core';
import { MAX_UNITS, type CartLine } from './cart';
import { MAX_HELD, MAX_HELD_LINES, type HoldResult, type ParsedBook } from './holds';
import { formatKg, MAX_WEIGHT_THOUSANDTHS } from './weight';

/** A screen's title with the branch the till is at, so a person who works at several always sees where they are ringing. */
export function titleAt(base: string, branchName: string | null | undefined): string {
  const where = cleanDisplayText(branchName ?? '', 40);
  return where ? `${base} · ${where}` : base;
}

/** What to tell the cashier when the products could not be loaded. */
export function describeItemsFailure(error: unknown): string {
  if (isApiError(error) && error.status === 403) {
    return 'Your role is not allowed to look up products. Ask the owner to allow it.';
  }
  return 'Could not load products. Check the connection and try again.';
}

/**
 * Said at the till when a price was set by hand and this person may not change prices. The server refuses such a sale,
 * and says so only after the customer has paid: so the till says it first.
 */
export function describeHandPrices(lines: readonly CartLine[]): string {
  const names = lines.slice(0, 3).map((line) => cleanDisplayText(line.name, 40) || 'An item');
  const more = lines.length - names.length;
  const list = more > 0 ? `${names.join(', ')} and ${more} more` : names.join(', ');
  const plural = lines.length !== 1;
  return `${list} ${plural ? 'have prices that were set by hand' : 'has a price that was set by hand'}, and you may not change prices here. Use the shelf ${plural ? 'prices' : 'price'}, or ask someone who may.`;
}

/** The button that answers `describeHandPrices`. */
export const USE_SHELF_PRICES = 'Use shelf prices';

/**
 * What a barcode that no product has is called on screen: what was scanned may be anything a code can hold, so it is
 * cleaned and cut. From the phone's own list, "no product" only means "not on the list saved here".
 */
export function describeNoBarcode(scanned: unknown, onPhone = false): string {
  const code = cleanDisplayText(scanned, 40);
  if (onPhone) {
    return code
      ? `The list saved on this phone has no product with the barcode ${code}. It may be a product added since.`
      : 'The list saved on this phone has no product with that barcode. It may be a product added since.';
  }
  return code ? `No product has the barcode ${code}.` : 'No product has that barcode.';
}

/** What to tell the cashier when the pending grocery invoices could not be loaded, or one could not be paid. Never the server's own words. */
export function describeInvoiceFailure(error: unknown, doing: 'load' | 'pay'): string {
  if (isApiError(error) && error.status === 403) return 'Your role is not allowed to do that. Ask the owner to allow it.';
  return doing === 'load'
    ? 'Could not load the invoices. Check the connection and try again.'
    : 'The invoice may not have been paid. Look at the list again before trying once more.';
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
    case 'unreadable':
      return 'Something in this basket cannot be kept on this phone, so it cannot be put on hold. Finish this sale, or take out the last item you added.';
    case 'service':
      return 'A sale with a service in it cannot be put on hold. Finish this sale, or take the service out first.';
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
  'That basket could not be picked up. It may have run out (a basket is kept for a day). If you are ringing a sale, it may be one that cannot be put aside: finish it first.';

/** Why one more of a counted item, or more weight of a weighed one, was refused (the item itself can be sold). */
export function describeAddRefusal(weighed: boolean): string {
  return weighed
    ? `One line cannot weigh more than ${formatKg(MAX_WEIGHT_THOUSANDTHS)}.`
    : `One line cannot be more than ${MAX_UNITS.toLocaleString('en-US')} of an item.`;
}
