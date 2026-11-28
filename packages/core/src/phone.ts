/**
 * A Kenyan mobile number as the M-Pesa prompt needs it: 254 and nine digits. Reads the ways people write one
 * (0712 345 678, +254 712 345 678, 254712345678, 712345678) the same way the server does, and is stricter than it:
 * only 07xx and 01xx numbers are mobiles, so a landline or a short number is refused here instead of sending a
 * prompt that goes nowhere. Null when it is not one.
 */
export function normalizeKenyanPhone(raw: string): string | null {
  let digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    digits = `254${digits.slice(1)}`;
  } else if (!digits.startsWith('254')) {
    digits = `254${digits}`;
  }
  // "+254 0712 345 678" keeps the leading zero: 2540712345678 is 254712345678.
  digits = digits.replace(/^2540([17]\d{8})$/, '254$1');
  return /^254[17]\d{8}$/.test(digits) ? digits : null;
}
