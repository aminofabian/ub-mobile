/**
 * Which lines in the basket were priced from the list saved on the phone, and how old that list was. A price from that
 * list may have moved since, and the server says so only after the customer has paid: it turns a sale down when a line
 * is not at the shop's price and the person is not allowed to set prices. So the till keeps the age of every price that
 * came from the phone's list, tells the cashier before the sale, and writes it on the sale if it is saved for later.
 *
 * Marks are per item, for the basket in front of the cashier. A basket put on hold or brought back has none: its prices
 * are checked against the shop when it is brought back (see `recall-flow`), and said so when they could not be.
 */
export type PhonePrices = Record<string, number>;

const has = (marks: PhonePrices, itemId: string): boolean => Object.prototype.hasOwnProperty.call(marks, itemId);

/**
 * After an item was added to the basket: a line that is new takes the age of the list it was priced from, or none when
 * the shop itself gave the price (`asOf` null). A line that was already there keeps the price it was rung at, and so
 * its mark.
 */
export function markAdded(
  marks: PhonePrices,
  before: readonly { itemId: string }[],
  itemId: string,
  asOf: number | null
): PhonePrices {
  if (before.some((line) => line.itemId === itemId)) return marks;
  const next: PhonePrices = { ...marks };
  if (typeof asOf === 'number' && Number.isFinite(asOf) && asOf > 0) next[itemId] = asOf;
  else delete next[itemId];
  return next;
}

/** Only the marks of lines that are still in the basket. */
export function keepMarksFor(cart: readonly { itemId: string }[], marks: PhonePrices): PhonePrices {
  const kept: PhonePrices = {};
  for (const line of cart) if (has(marks, line.itemId)) kept[line.itemId] = marks[line.itemId];
  return kept;
}

/** When the oldest list that any line in the basket was priced from was made, or null when every price is the shop's own. */
export function oldestMark(cart: readonly { itemId: string }[], marks: PhonePrices): number | null {
  let oldest: number | null = null;
  for (const line of cart) {
    if (!has(marks, line.itemId)) continue;
    const at = marks[line.itemId];
    if (typeof at === 'number' && Number.isFinite(at) && (oldest === null || at < oldest)) oldest = at;
  }
  return oldest;
}
