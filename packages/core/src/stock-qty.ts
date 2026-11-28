/**
 * Quantities of stock are counted in ten-thousandths, as whole numbers, everywhere inside the app. The server keeps
 * four decimals, and "how much to add" is a subtraction of two quantities: as ordinary floating-point numbers
 * 10.3 - 7.1 is 3.1999999999999993, and a stock change a hair off is a stock change that is wrong. A quantity is a
 * plain number only at the edges: on the screen, and in what is sent to the server.
 */

/** Ten-thousandths in one unit (one item, one kilogram). */
export const QTY_SCALE = 10_000;

/** The most one typed quantity can be: a million units. A slipped finger, not a count. */
export const MAX_QTY_UNITS = 1_000_000 * QTY_SCALE;

/** The most a quantity read from the server can be before it is called bad data. */
const MAX_READ_UNITS = 1_000_000_000 * QTY_SCALE;

export type QtyProblem = 'empty' | 'not_a_number' | 'too_many_decimals' | 'zero' | 'too_big';

export type QtyEntry = { ok: true; units: number } | { ok: false; problem: QtyProblem };

// Digits, optionally followed by a point and more digits. A comma is not a decimal mark here: "1,250" must never be
// read as 1.25 or as 1250.
const QTY_TEXT = /^(\d*)(?:\.(\d*))?$/;

/**
 * What a person typed into a quantity box, in ten-thousandths, or why it is not a quantity.
 * "12", "2.5", ".5" and "1." are quantities; "1,5", "1e3", "-2", "1.23456" and "" are not. Zero is a quantity only
 * where `allowZero` says a count of nothing is meaningful (a stock take, "set to"), never for a write-off.
 */
export function parseQty(text: string, options: { allowZero?: boolean } = {}): QtyEntry {
  const typed = text.trim();
  if (!typed) return { ok: false, problem: 'empty' };
  const match = QTY_TEXT.exec(typed);
  if (!match) return { ok: false, problem: 'not_a_number' };
  const whole = (match[1] ?? '').replace(/^0+(?=\d)/, '');
  const fraction = match[2] ?? '';
  if (!whole && !fraction) return { ok: false, problem: 'not_a_number' };
  // Zeros after the fourth decimal say nothing more: "1.50000" is 1.5. Any other digit there is more than the server keeps.
  const significant = fraction.replace(/0+$/, '');
  if (significant.length > 4) return { ok: false, problem: 'too_many_decimals' };
  // More than seven whole digits is over a million before any arithmetic is done on it.
  if (whole.length > 7) return { ok: false, problem: 'too_big' };
  const units = Number(whole || '0') * QTY_SCALE + Number(significant.padEnd(4, '0'));
  if (units === 0 && options.allowZero !== true) return { ok: false, problem: 'zero' };
  if (units > MAX_QTY_UNITS) return { ok: false, problem: 'too_big' };
  return { ok: true, units };
}

/** What to tell the person about a quantity that cannot be used. */
export function qtyProblemWords(problem: QtyProblem): string {
  switch (problem) {
    case 'empty':
      return 'Enter a quantity.';
    case 'not_a_number':
      return 'Use digits and a point, like 2.5.';
    case 'too_many_decimals':
      return 'Four decimals at most, like 0.125.';
    case 'zero':
      return 'The quantity must be above zero.';
    case 'too_big':
      return 'That is over a million. Check the number.';
  }
}

const NUMERIC_TEXT = /^-?\d{1,12}(?:\.\d{1,12})?$/;

/**
 * A quantity as the server sent it (a number, or a number in text) in ten-thousandths. Null for anything that is not
 * a number, or is absurdly large. A negative quantity is kept: a shop that allows selling below zero has one.
 */
export function qtyToUnits(value: unknown): number | null {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string' && NUMERIC_TEXT.test(value.trim())) {
    n = Number(value.trim());
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  const units = Math.round(n * QTY_SCALE);
  return Math.abs(units) <= MAX_READ_UNITS ? units : null;
}

/** Ten-thousandths as the number the server is sent. Exact to four decimals. */
export function unitsToQty(units: number): number {
  return Math.round(units) / QTY_SCALE;
}

/** 25000 -> "2.5", 10000 -> "1", -30000 -> "-3", 12345000 -> "1,234.5". The thousands are grouped by commas. */
export function formatQty(units: number): string {
  const rounded = Math.round(units);
  const negative = rounded < 0;
  const absolute = Math.abs(rounded);
  const whole = Math.floor(absolute / QTY_SCALE);
  const fraction = absolute % QTY_SCALE;
  const decimals = fraction === 0 ? '' : `.${String(fraction).padStart(4, '0').replace(/0+$/, '')}`;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${decimals}`;
}
