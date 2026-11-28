/**
 * The weight rules live in `@kiosk/core` now, so the till and the owner's app sell by the same arithmetic. This file
 * stays as the till's own way in, so nothing that already imports it has to change.
 */
export {
  MAX_WEIGHT_THOUSANDTHS,
  parseWeightKg,
  weightProblemWords,
  thousandthsToKg,
  kgToThousandths,
  formatKg,
  howToSell,
  previewWeighedLine,
  weightForSpend,
} from '@kiosk/core';
export type {
  WeightProblem,
  WeightEntry,
  Sellable,
  SaleMode,
  WeighedPreview,
  SpendPreview,
} from '@kiosk/core';
