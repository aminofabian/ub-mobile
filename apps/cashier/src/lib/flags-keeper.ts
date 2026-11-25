import { readTenantValue, writeTenantValue } from '@kiosk/core';
import { encodeStoredFlags, parseStoredFlags, type ShopFlags } from './shop-flags';

/**
 * What the shop last said its till may do, kept on the phone so that a till that starts with no connection still
 * shows the buttons the shop allows (a week at most: see `parseStoredFlags`). The shop's own answer, whenever the till
 * gets one, replaces it.
 */

/** The settings kept for this shop, or null when there are none worth believing. Never fails. */
export async function readStoredFlags(tenantId: string, now: number): Promise<ShopFlags | null> {
  try {
    return parseStoredFlags(await readTenantValue('shopFlags', tenantId), now);
  } catch {
    return null;
  }
}

/** Keeps what the shop just said. A phone that cannot keep it is not an error: the till asks the shop again next time. */
export async function keepFlags(tenantId: string, flags: ShopFlags, now: number): Promise<void> {
  try {
    await writeTenantValue('shopFlags', encodeStoredFlags(flags, now), tenantId);
  } catch {
    // Nothing to do: the settings are in memory for as long as the app runs.
  }
}
