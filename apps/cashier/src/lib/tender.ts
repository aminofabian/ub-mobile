/**
 * The tender rules live in `@kiosk/core` now, so the owner's app takes money by the same rules as the till: the same
 * M-Pesa code checks, the same whole-shilling share, the same change. This file stays as the till's way in.
 */
export {
  MPESA_CODE_MIN,
  MPESA_CODE_MAX,
  MPESA_CODE_USUAL,
  normalizeMpesaCode,
  isMpesaCode,
  mpesaCodeLooksOdd,
  wholeShillings,
  planPayments,
  describePlanProblem,
  cashSuggestions,
} from '@kiosk/core';
export type {
  Tender,
  TenderKind,
  SalePayment,
  PlanProblem,
  Plan,
  PlanRequest,
} from '@kiosk/core';
