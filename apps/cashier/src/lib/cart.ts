import { formatMoney, fromCents, lineCents, toCents, totalCents } from './money';
import {
  formatKg,
  howToSell,
  MAX_WEIGHT_THOUSANDTHS,
  thousandthsToKg,
  type Sellable,
} from './weight';

/**
 * The basket, as plain functions: each takes the basket and gives back a new one (or null when it cannot be done),
 * and none changes what it was given. The store only holds the answer.
 */

/** What the till needs to know of an item to put it in the basket. */
export interface CartItem extends Sellable {
  id: string;
  name: string;
  barcode?: string;
  sellingPrice: number;
  stockOnHand?: number;
}

export interface CartLine {
  itemId: string;
  name: string;
  /** Whole units, or kilograms (three decimals at most) for a line sold by weight. */
  quantity: number;
  /** Shillings per unit, or per kilogram for a weighed line: what is sent to the server. */
  unitPrice: number;
  /** A line sold by weight: its quantity is in kilograms. */
  weighed?: true;
  /** The shelf price this line was changed from. Present only while the price on the line is not the shelf price. */
  shelfPrice?: number;
}

/** The most of one item that taps can add: a slipped finger, not a sale. */
export const MAX_UNITS = 9_999;

/** Why an item cannot be rung up as it stands, in words for the cashier. Null when it can. */
export function cannotAdd(item: CartItem): string | null {
  const how = howToSell(item);
  if (how.kind === 'blocked') return how.why;
  if (!(item.sellingPrice > 0) || !Number.isFinite(item.sellingPrice)) {
    return 'This item has no price. Ask the owner to set one.';
  }
  return null;
}

function indexOfLine(cart: readonly CartLine[], itemId: string): number {
  return cart.findIndex((line) => line.itemId === itemId);
}

/** A line's weight in thousandths of a kilogram. */
export function lineThousandths(line: CartLine): number {
  return Math.round(line.quantity * 1000);
}

function replaceAt(cart: readonly CartLine[], at: number, next: CartLine): CartLine[] {
  return cart.map((line, index) => (index === at ? next : line));
}

/** One more of an item sold by the unit. Null when the item is sold by weight or is not for sale, or the line is full. */
export function addUnit(cart: readonly CartLine[], item: CartItem): CartLine[] | null {
  if (cannotAdd(item) !== null || howToSell(item).kind !== 'units') return null;
  const at = indexOfLine(cart, item.id);
  const line = cart[at];
  if (!line) {
    return [...cart, { itemId: item.id, name: item.name, quantity: 1, unitPrice: item.sellingPrice }];
  }
  if (line.weighed || line.quantity + 1 > MAX_UNITS) return null;
  return replaceAt(cart, at, { ...line, quantity: line.quantity + 1 });
}

/**
 * A weighing of an item sold by weight. A second weighing of the same item is added to the first: one line per item.
 * Null when the item cannot be sold by weight, or the line would pass the most one line may weigh.
 */
export function addWeight(cart: readonly CartLine[], item: CartItem, thousandths: number): CartLine[] | null {
  if (cannotAdd(item) !== null || howToSell(item).kind !== 'kg') return null;
  if (!Number.isSafeInteger(thousandths) || thousandths <= 0) return null;
  const at = indexOfLine(cart, item.id);
  const line = cart[at];
  if (!line) {
    if (thousandths > MAX_WEIGHT_THOUSANDTHS) return null;
    return [
      ...cart,
      { itemId: item.id, name: item.name, quantity: thousandthsToKg(thousandths), unitPrice: item.sellingPrice, weighed: true },
    ];
  }
  if (!line.weighed) return null;
  const sum = lineThousandths(line) + thousandths;
  if (sum > MAX_WEIGHT_THOUSANDTHS) return null;
  return replaceAt(cart, at, { ...line, quantity: thousandthsToKg(sum) });
}

/** Weighs a line again: the new weight replaces the old one. Null for a line that is not weighed, or a bad weight. */
export function setWeight(cart: readonly CartLine[], itemId: string, thousandths: number): CartLine[] | null {
  const at = indexOfLine(cart, itemId);
  const line = cart[at];
  if (!line || !line.weighed) return null;
  if (!Number.isSafeInteger(thousandths) || thousandths <= 0 || thousandths > MAX_WEIGHT_THOUSANDTHS) return null;
  return replaceAt(cart, at, { ...line, quantity: thousandthsToKg(thousandths) });
}

/** A new count of units for a line. Zero or less takes the line out. Null for a weighed line, a part of a unit, or too many. */
export function setUnits(cart: readonly CartLine[], itemId: string, quantity: number): CartLine[] | null {
  const at = indexOfLine(cart, itemId);
  const line = cart[at];
  if (!line || line.weighed || !Number.isInteger(quantity)) return null;
  if (quantity <= 0) return removeLine(cart, itemId);
  if (quantity > MAX_UNITS) return null;
  return replaceAt(cart, at, { ...line, quantity });
}

export function removeLine(cart: readonly CartLine[], itemId: string): CartLine[] {
  return cart.filter((line) => line.itemId !== itemId);
}

/** A weighed line as the item to weigh again: what it is called, its price per kilogram as it stands, sold in kg. */
export function weighedItemOf(line: CartLine): CartItem {
  return { id: line.itemId, name: line.name, sellingPrice: line.unitPrice, weighed: true, unitType: 'kg' };
}

/** The line at the given price with no change remembered: it is the shelf price. */
export function onShelfPrice(line: CartLine, shelfPrice: number): CartLine {
  return {
    itemId: line.itemId,
    name: line.name,
    quantity: line.quantity,
    unitPrice: shelfPrice,
    ...(line.weighed ? { weighed: true as const } : {}),
  };
}

/**
 * The cashier's price for a line, in cents. The shelf price it came from is kept so the change stays visible, and
 * typing the shelf price again puts the line back on it. Null when the line is not there or the price is not above zero.
 */
export function setLinePrice(cart: readonly CartLine[], itemId: string, cents: number): CartLine[] | null {
  const at = indexOfLine(cart, itemId);
  const line = cart[at];
  if (!line || !Number.isSafeInteger(cents) || cents <= 0) return null;
  const shelf = line.shelfPrice ?? line.unitPrice;
  if (cents === toCents(shelf)) return replaceAt(cart, at, onShelfPrice(line, shelf));
  return replaceAt(cart, at, { ...line, unitPrice: fromCents(cents), shelfPrice: shelf });
}

/** Whether the price on the line is not the shelf price. */
export function priceChanged(line: CartLine): boolean {
  return line.shelfPrice !== undefined && toCents(line.shelfPrice) !== toCents(line.unitPrice);
}

/** One line's total in cents. Null when its quantity or price cannot be counted. */
export function lineTotalCents(line: CartLine): number | null {
  return lineCents(line.quantity, line.unitPrice);
}

/** The basket's total in cents. Null when any line cannot be counted: the sale cannot be paid yet. An empty basket is 0. */
export function cartCents(cart: readonly CartLine[]): number | null {
  return totalCents(cart.map((line) => ({ quantity: line.quantity, unitPrice: line.unitPrice })));
}

export interface LineWords {
  /** "3", or "1.25 kg". */
  quantity: string;
  /** "65.00", or "450.00 per kg". */
  price: string;
  /** The line total: "195.00". A dash when it cannot be counted. */
  total: string;
  /** The shelf price, while the line is not at it: "500.00". */
  was?: string;
}

/** What one basket line says on the screen. */
export function lineWords(line: CartLine): LineWords {
  const cents = toCents(line.unitPrice);
  const price = cents === null ? '-' : formatMoney(cents);
  const total = lineTotalCents(line);
  const shelf = priceChanged(line) && line.shelfPrice !== undefined ? toCents(line.shelfPrice) : null;
  return {
    quantity: line.weighed ? formatKg(lineThousandths(line)) : String(line.quantity),
    price: line.weighed ? `${price} per kg` : price,
    total: total === null ? '-' : formatMoney(total),
    ...(shelf !== null ? { was: formatMoney(shelf) } : {}),
  };
}
