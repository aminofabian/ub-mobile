import { readTenantValue, writeTenantValue } from '@kiosk/core';

/**
 * The tips a cashier sees on their first day, once.
 *
 * Kept per shop and per person, on the phone that person signed in on: a second cashier on the same till still gets
 * their own first run, and someone who skips it is never shown it again. If the phone cannot remember, the tour is
 * simply offered again next time — never an error, never a blocked till.
 */
export const FIRST_RUN_TIPS = [
  {
    title: 'Tap a product to add it',
    body: 'It lands in the basket with a small flight, so you can watch it go. The same tap takes one more.',
  },
  {
    title: 'Hold a basket, don’t lose it',
    body: 'If a customer steps aside, the pause button keeps their basket waiting while you serve the next person.',
  },
  {
    title: 'Check out, then hand back the change',
    body: 'The amount due stays pinned at the top. Once it is paid, the sale is sent and the receipt is ready to print.',
  },
] as const;

export type FirstRunTip = (typeof FIRST_RUN_TIPS)[number];

/** The people at this shop who have already been shown the tips. */
function parseSeen(raw: string | null): Record<string, true> {
  if (!raw) return {};
  try {
    const found = JSON.parse(raw) as unknown;
    return found && typeof found === 'object' ? (found as Record<string, true>) : {};
  } catch {
    return {};
  }
}

/** Whether this person, at this shop, still has their first day ahead of them. Never fails. */
export async function needsFirstRun(tenantId: string, userId: string): Promise<boolean> {
  try {
    return parseSeen(await readTenantValue('firstRun', tenantId))[userId] !== true;
  } catch {
    return true;
  }
}

/** Records that they have seen the tour (or chosen to skip it). A phone that cannot keep it is not an error. */
export async function markFirstRunSeen(tenantId: string, userId: string): Promise<void> {
  try {
    const seen = parseSeen(await readTenantValue('firstRun', tenantId));
    seen[userId] = true;
    await writeTenantValue('firstRun', JSON.stringify(seen), tenantId);
  } catch {
    // Nothing to do: it will be offered again next time.
  }
}
