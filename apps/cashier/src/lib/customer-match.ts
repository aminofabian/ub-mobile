/**
 * Moved to `@kiosk/core` so the till and the owner's app decide the same things about the same person. This file stays
 * as the till's way in.
 */
export {
  matchCustomers,
} from '@kiosk/core';
export type {
  CustomerMatch,
} from '@kiosk/core';
