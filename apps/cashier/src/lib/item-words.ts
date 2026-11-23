import { cannotAdd, type CartItem } from './cart';
import { formatMoney, toCents } from './money';
import { formatKg, howToSell, kgToThousandths } from './weight';

/** What a product row on the till says. */
export interface ItemWords {
  /** "130.00", or "650.00 per kg". A dash when it has no usable price. */
  price: string;
  /** "12 in stock", "1.25 kg in stock", or "Out of stock". Absent when the server did not say. */
  stock?: string;
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

export function itemWords(item: CartItem): ItemWords {
  const byWeight = howToSell(item).kind === 'kg';
  const cents = toCents(item.sellingPrice);
  const price = cents === null || cents <= 0 ? '-' : `${formatMoney(cents)}${byWeight ? ' per kg' : ''}`;
  const blocked = cannotAdd(item);
  return {
    price,
    ...(typeof item.stockOnHand === 'number' ? { stock: stockWords(item.stockOnHand, byWeight) } : {}),
    ...(blocked !== null ? { blocked } : {}),
    byWeight,
  };
}
