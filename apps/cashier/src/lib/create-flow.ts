import type { CartItem } from './cart';
import { describeCreateFailure, weighedFailureWords, type QuickCreateBody } from './quick-product';

/** How long adding a product is waited for. A product is only added once, so the wait is long. */
export const CREATE_WAIT_MS = 25_000;

/** What came of adding a product. */
export type CreateOutcome =
  /** Added, and ready to ring up. The notice is what the till says when it takes the cashier back. */
  | { kind: 'done'; item: CartItem; notice: string }
  /** The server turned it down: nothing was added, and the form can be fixed and sent again. */
  | { kind: 'refused'; words: string }
  /**
   * Nobody answered: the product may or may not have been added, and adding it again could count its opening stock
   * twice. The cashier is sent to look for it, and cannot add it again from here.
   */
  | { kind: 'unknown'; words: string }
  /** Added, but marking it as sold by weight did not work: until it does it would sell by the unit at its per-kg price. */
  | { kind: 'weight'; made: CartItem; words: string };

function added(made: CartItem, weighed: boolean): CreateOutcome {
  const item: CartItem = weighed ? { ...made, weighed: true, unitType: 'kg' } : made;
  return { kind: 'done', item, notice: `Added ${item.name}. Tap it to sell it.` };
}

/** Marks a product just added as sold by weight. Safe to do again: the server sets it to what it is told. */
export async function markAsWeighed(made: CartItem, mark: (itemId: string) => Promise<void>): Promise<CreateOutcome> {
  try {
    await mark(made.id);
  } catch (error) {
    return { kind: 'weight', made, words: weighedFailureWords(error) };
  }
  return added(made, true);
}

/**
 * Adds a product, and marks it as sold by weight when it is. The add is never sent twice: only the marking is tried
 * again, and only when the cashier asks.
 */
export async function createProduct(input: {
  body: QuickCreateBody;
  byWeight: boolean;
  create: (body: QuickCreateBody) => Promise<CartItem>;
  mark: (itemId: string) => Promise<void>;
}): Promise<CreateOutcome> {
  let made: CartItem;
  try {
    made = await input.create(input.body);
  } catch (error) {
    const failure = describeCreateFailure(error);
    return { kind: failure.kind, words: failure.words };
  }
  return input.byWeight ? markAsWeighed(made, input.mark) : added(made, false);
}

/** What the till says when the cashier leaves a weighed product that could not be marked: said plainly, once. */
export function leftUnweighedNotice(name: string): string {
  return `${name} was added but is NOT marked as sold by weight yet. Do not sell it until the owner changes it: it would be charged per unit, not per kilogram.`;
}

/** What the till says when the cashier is sent to look for a product that may have been added. */
export function lookForItNotice(name: string): string {
  return `Look for ${name} below. If it is there, it was added: sell it from the list. If not, add it again.`;
}
