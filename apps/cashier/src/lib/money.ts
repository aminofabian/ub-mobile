/**
 * The money rules live in `@kiosk/core` now, so the till and the owner's app sell by the same arithmetic. This file
 * stays as the till's own way in, so nothing that already imports it has to change.
 */
export {
  MAX_TYPED_CENTS,
  toCents,
  fromCents,
  formatMoney,
  parseMoney,
  lineCents,
  totalCents,
} from '@kiosk/core';
