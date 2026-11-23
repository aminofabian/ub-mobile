/**
 * Money at the till is counted in whole cents, as integers, everywhere inside the app. Shillings with two decimals
 * appear only at the edges: on the screen, and in what is sent to the server. Adding prices as ordinary
 * floating-point numbers drifts (0.1 + 0.2 is 0.30000000000000004), and a payment a hair under the total is refused
 * by the server as not covering it.
 */

/** The most one amount typed by hand can be: ten million shillings. A slipped finger, not a sale. */
export const MAX_TYPED_CENTS = 10_000_000 * 100;

/** Shillings as the server sends them (at most two decimals) to whole cents. Null for anything that is not a number. */
export function toCents(amount: number): number | null {
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

/** Whole cents to shillings, for the server. The result has at most two decimals. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** 125050 -> "1,250.50". Always two decimals, thousands grouped by commas. */
export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const whole = Math.floor(Math.abs(Math.round(cents)) / 100);
  const fraction = Math.abs(Math.round(cents)) % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}.${String(fraction).padStart(2, '0')}`;
}

// Digits, optionally grouped in threes by commas, optionally followed by a point and one or two decimals.
const TYPED_AMOUNT = /^(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d{1,2})?$/;

/**
 * What a person typed into an amount box, in cents, or null when it is not an amount. Strict on purpose: "12,50" is
 * refused rather than read as 1,250, because a comma here is a thousands separator and a slip like that moves
 * a hundred times the money.
 */
export function parseMoney(text: string): number | null {
  const typed = text.trim();
  if (!typed || !TYPED_AMOUNT.test(typed)) return null;
  const [whole = '', fraction = ''] = typed.replace(/,/g, '').split('.');
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= MAX_TYPED_CENTS ? cents : null;
}

/**
 * What one basket line costs in cents, rounded half up the way the server rounds a line (quantity times unit price,
 * to two decimals). Quantity is read to thousandths (weighed goods), the price to ten-thousandths. Null for a
 * quantity or price that is not a number, a quantity that is not above zero, or a price below zero.
 */
export function lineCents(quantity: number, unitPrice: number): number | null {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) return null;
  const thousandths = BigInt(Math.round(quantity * 1000));
  const tenThousandths = BigInt(Math.round(unitPrice * 10000));
  // thousandths x ten-thousandths is 10^7 to the shilling, so 10^5 to the cent.
  const cents = (thousandths * tenThousandths + BigInt(50000)) / BigInt(100000);
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

/** The basket's total in cents. Null when any line has no usable quantity or price: the sale cannot be paid yet. */
export function totalCents(lines: { quantity: number; unitPrice: number }[]): number | null {
  let total = 0;
  for (const line of lines) {
    const cents = lineCents(line.quantity, line.unitPrice);
    if (cents === null) return null;
    total += cents;
  }
  return Number.isSafeInteger(total) ? total : null;
}
