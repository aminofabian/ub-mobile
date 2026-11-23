import { formatMoney, parseMoney } from './money';

/** What a cashier typed as the price for a line, in cents, or what is wrong with it in words for them. */
export type PriceEntry = { ok: true; cents: number } | { ok: false; words: string };

export function checkPriceEntry(text: string): PriceEntry {
  const cents = parseMoney(text);
  if (cents === null) return { ok: false, words: 'Enter the price like 120 or 120.50, up to 10,000,000.' };
  if (cents < 1) return { ok: false, words: 'The price must be above zero.' };
  return { ok: true, cents };
}

/** How far a price the cashier typed is from the shelf's, as much a slip (an extra or a missing zero) as a choice. */
export interface PriceChange {
  /** Whole percent away from the shelf price, never negative. */
  percent: number;
  direction: 'same' | 'higher' | 'lower';
  /** "10.00 is 92% below the shelf price of 120.00". */
  words: string;
  /** Far enough from the shelf price that the cashier should look twice. */
  large: boolean;
}

/** Half the price or less, or half as much again or more: worth a second look. */
const LARGE_PERCENT = 50;

export function describePriceChange(shelfCents: number, newCents: number): PriceChange {
  if (!(shelfCents > 0) || !(newCents > 0) || newCents === shelfCents) {
    return { percent: 0, direction: 'same', words: 'This is the shelf price.', large: false };
  }
  const percent = Math.round((Math.abs(newCents - shelfCents) / shelfCents) * 100);
  const direction = newCents > shelfCents ? 'higher' : 'lower';
  const below = direction === 'lower';
  return {
    percent,
    direction,
    words: `${formatMoney(newCents)} is ${percent}% ${below ? 'below' : 'above'} the shelf price of ${formatMoney(shelfCents)}`,
    large: percent >= LARGE_PERCENT,
  };
}
