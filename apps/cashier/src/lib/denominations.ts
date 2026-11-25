/**
 * Counting the cash drawer by denomination. The server takes a single total for opening and closing a shift, so this
 * is a counting aid on the phone: the cashier taps how many of each note and coin they have, and the app adds it up to
 * the total it sends. Kenyan shilling notes and coins, newest series.
 */

/** KES notes and coins the drawer holds, biggest first. Values are in whole shillings. */
export const KES_DENOMINATIONS: readonly number[] = [1000, 500, 200, 100, 50, 20, 10, 5, 1];

/** Which values are notes (the rest are coins), for grouping in the UI. */
export const KES_NOTES: readonly number[] = [1000, 500, 200, 100, 50];

export function isNote(value: number): boolean {
  return KES_NOTES.includes(value);
}

/** A count of each denomination: how many of the KES-1000 note, the KES-50 note, the KES-1 coin, and so on. */
export type DrawerCount = Record<number, number>;

/** An empty drawer: zero of everything. */
export function emptyDrawer(): DrawerCount {
  const count: DrawerCount = {};
  for (const value of KES_DENOMINATIONS) count[value] = 0;
  return count;
}

/** The total the drawer holds, in whole shillings. */
export function drawerTotal(count: DrawerCount): number {
  return KES_DENOMINATIONS.reduce((sum, value) => sum + value * (count[value] ?? 0), 0);
}

/** The total in cents, for the shift API (which counts in cents). */
export function drawerTotalCents(count: DrawerCount): number {
  return drawerTotal(count) * 100;
}

/** How many notes or coins are in the drawer in all. */
export function drawerPieces(count: DrawerCount): number {
  return KES_DENOMINATIONS.reduce((sum, value) => sum + (count[value] ?? 0), 0);
}

/** Set the count for one denomination, never below zero. */
export function setCount(count: DrawerCount, value: number, n: number): DrawerCount {
  return { ...count, [value]: Math.max(0, Math.trunc(n)) };
}

/** Add or remove one of a denomination, never below zero. */
export function bump(count: DrawerCount, value: number, by: number): DrawerCount {
  return setCount(count, value, (count[value] ?? 0) + by);
}

/** The label for a denomination, e.g. "KES 1,000" or "KES 1". */
export function denomLabel(value: number): string {
  return `KES ${value.toLocaleString('en-KE')}`;
}
