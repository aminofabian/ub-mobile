import { paidByMpesa } from './sale-summary';
import { PERMISSION } from './shop-flags';

/**
 * Who may throw away a sale that was never sent. A sale paid by M-Pesa has the customer's money in it, and the copy on
 * the phone may be the only record that the sale happened: only a person who may void any sale may discard it. Any
 * other sale may be discarded by the cashier, and is written in the till's log either way.
 */
export function mayDiscard(item: { body?: unknown }, permissions: readonly string[]): boolean {
  return !paidByMpesa(item) || permissions.includes(PERMISSION.voidAny);
}

/** Only a person who may void any sale clears what the till wrote down for a manager. */
export function mayClearLog(permissions: readonly string[]): boolean {
  return permissions.includes(PERMISSION.voidAny);
}

export const DISCARD_NEEDS_MANAGER =
  "Only a manager can discard a sale that was paid by M-Pesa: the customer's money is with the shop, and this copy may be the only record of it. Ask your manager to sign in on this phone.";
