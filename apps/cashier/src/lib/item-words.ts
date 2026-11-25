import { cannotAdd, type CartItem } from './cart';
import { formatMoney, toCents } from './money';
import { formatKg, howToSell, kgToThousandths } from './weight';

/** How much is left, for colouring the stock line: out (red), low (amber), or ok (quiet). */
export type StockLevel = 'out' | 'low' | 'ok';

/**
 * At or below this many units, a product is "low" and shown in amber — a nudge to reorder before it
 * runs out. A small-shop default; the server has no per-item reorder level on the till's catalogue.
 */
export const LOW_STOCK_AT = 5;

/** What a product row on the till says. */
export interface ItemWords {
  /** "130.00", or "650.00 per kg". A dash when it has no usable price. */
  price: string;
  /** "12 in stock", "1.25 kg in stock", or "Out of stock". Absent when the server did not say. */
  stock?: string;
  /** How much is left, so the tile can colour it. Absent when the server did not say the count. */
  stockLevel?: StockLevel;
  /** Why it cannot be rung up as it stands. Absent when it can. */
  blocked?: string;
  /** Sold by weight: tapping it asks for a weight. */
  byWeight: boolean;
}

function stockWords(onHand: number, byWeight: boolean): string {
  if (!Number.isFinite(onHand) || onHand <= 0) return 'Out of stock';
  if (byWeight) {
    const thousandths = kgToThousandths(onHand);
    return thousandths === null ? 'In stock' : `${formatKg(thousandths)} in stock`;
  }
  return `${Number.isInteger(onHand) ? onHand : Math.round(onHand * 1000) / 1000} in stock`;
}

function stockLevel(onHand: number): StockLevel {
  if (!Number.isFinite(onHand) || onHand <= 0) return 'out';
  if (onHand <= LOW_STOCK_AT) return 'low';
  return 'ok';
}

export function itemWords(item: CartItem): ItemWords {
  const byWeight = howToSell(item).kind === 'kg';
  const cents = toCents(item.sellingPrice);
  const price = cents === null || cents <= 0 ? '-' : `${formatMoney(cents)}${byWeight ? ' per kg' : ''}`;
  const blocked = cannotAdd(item);
  const hasStock = typeof item.stockOnHand === 'number';
  return {
    price,
    ...(hasStock ? { stock: stockWords(item.stockOnHand as number, byWeight) } : {}),
    ...(hasStock ? { stockLevel: stockLevel(item.stockOnHand as number) } : {}),
    ...(blocked !== null ? { blocked } : {}),
    byWeight,
  };
}
