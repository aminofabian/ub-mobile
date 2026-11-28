/**
 * The cart rules live in `@kiosk/core` now, so the till and the owner's app sell by the same arithmetic. This file
 * stays as the till's own way in, so nothing that already imports it has to change.
 */
export {
  SERVICE_ID_PREFIX,
  MAX_UNITS,
  cannotAdd,
  lineThousandths,
  addUnit,
  addWeight,
  setWeight,
  setUnits,
  removeLine,
  setLineWeighed,
  weighedItemOf,
  onShelfPrice,
  setLinePrice,
  priceChanged,
  handPriced,
  backToShelf,
  lineTotalCents,
  cartCents,
  lineWords,
} from '@kiosk/core';
export type {
  CartItem,
  ServiceTag,
  CartLine,
  LineWords,
} from '@kiosk/core';
