/**
 * Whose cart is on this phone. The till keeps the cart, the open shift and the last sale in memory, and the phone
 * is shared: one person signs out and the next signs in, often within a minute, in the same running app. What the
 * first person left is not the second person's to ring up, to see, or to close a shift over.
 */

export interface CartOwnerParts {
  /** The shop's slug, which does not change when its id goes from provisional to confirmed. */
  shop: string;
  branchId: string;
  userId: string;
}

/**
 * Names whose cart this is: one person, at one branch of one shop. The parts are joined as a list, so no two
 * different people can ever produce the same name by how their ids happen to run together.
 */
export function cartOwnerKey(parts: CartOwnerParts): string {
  return JSON.stringify([parts.shop, parts.branchId, parts.userId]);
}

/**
 * Whether what is held for `held` stays when `next` takes the till. The same person at the same branch keeps it
 * (a session that ran out in the middle of a sale does not lose the sale); anyone else, or another branch, starts
 * clean. Nothing held yet means there is nothing to keep.
 */
export function keepsCart(held: string | null, next: string): boolean {
  return held !== null && held === next;
}
