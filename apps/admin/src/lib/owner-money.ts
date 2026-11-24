import { formatKes } from '@kiosk/core';

const AMOUNT = /^-?\d{1,12}(?:\.\d{1,8})?$/;
const TYPED = /^\d{1,9}(?:\.\d{1,2})?$/;

/** The most the Owner screens will believe in one figure: 999,999,999.99 shillings, in cents. */
export const MAX_OWNER_CENTS = 99_999_999_999;

/**
 * A figure from the server (a JSON number or a decimal string) in whole cents, rounded half up on the third decimal.
 * It is signed, because a day's profit can be a loss. Anything that is not a plain amount is null, which is "not known"
 * and never zero: the next thing an owner does with a figure is decide something.
 */
export function signedCents(value: unknown): number | null {
  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    text = value.toFixed(6);
  } else if (typeof value === 'string') {
    text = value.trim();
  } else {
    return null;
  }
  if (!AMOUNT.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const digits = fraction.padEnd(3, '0');
  let cents = Number(whole) * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) cents += 1;
  if (cents > MAX_OWNER_CENTS) return null;
  return negative && cents !== 0 ? -cents : cents;
}

/** "KES 1,250.00", "-KES 300.00", or a dash for a figure that is not known. */
export function kesOrDash(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return '—';
  return cents < 0 ? `-${formatKes(-cents)}` : formatKes(cents);
}

/**
 * An amount a person typed, in whole cents: digits, and at most two decimals after a dot. A comma is refused, not
 * guessed at, because "1,250" is a thousand shillings to one reader and one and a quarter to another. Null when it is
 * not an amount; zero is returned as zero, for the caller to refuse.
 */
export function typedCents(text: string): number | null {
  const typed = text.trim();
  if (!TYPED.test(typed)) return null;
  const [whole = '0', fraction = ''] = typed.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/**
 * Whole cents as the number a money field of the server takes: 125050 becomes 1250.5. Null for anything that is not
 * whole, not safe, below zero or above what the Owner screens believe in, so a bad figure is never sent.
 */
export function centsToAmount(cents: number): number | null {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_OWNER_CENTS) return null;
  return Number((cents / 100).toFixed(2));
}

/**
 * Whole cents as they are typed into an amount box: 125050 becomes "1250.50", with no commas, so what is shown reads
 * back as the same figure through {@link typedCents}. Empty for anything that is not a sum of money.
 */
export function centsToTyped(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_OWNER_CENTS) return '';
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
