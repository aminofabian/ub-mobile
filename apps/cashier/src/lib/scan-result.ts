import type { CartItem } from './cart';

/** What a scanned barcode found at the till's branch. */
export type ScanResult =
  /** Exactly one product has the barcode: ring it up. */
  | { kind: 'one'; item: CartItem }
  /** Nothing can be sold under the barcode. */
  | { kind: 'none' }
  /** More than one product could be it, or the server answered with products that do not have this barcode: the cashier chooses. */
  | { kind: 'several'; items: CartItem[] };

/**
 * Reads the answer to "which product has this barcode". Only a product whose barcode is the one scanned is rung up
 * without asking: an answer of other products (the server matching more loosely than exactly) is shown for the cashier
 * to choose from, never added on a guess.
 */
export function pickScanned(items: readonly CartItem[], scanned: string): ScanResult {
  const value = scanned.trim();
  if (items.length === 0) return { kind: 'none' };
  const exact = items.filter((item) => value !== '' && item.barcode === value);
  const only = exact[0];
  if (exact.length === 1 && only) return { kind: 'one', item: only };
  return { kind: 'several', items: [...items] };
}
