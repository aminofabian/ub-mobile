import type { ApiClient } from '@kiosk/core';
import { fetchShopFlags } from '../api/pos-api';
import { PROBE_WAIT_MS } from './reach';
import type { ShopFlags } from './shop-flags';
import { withTimeout } from './with-timeout';

/**
 * Asks the shop one small thing, to find out whether the line is back. The answer (the shop's settings) is handed
 * back so it is not wasted. Null when nobody answered in time. The call goes through the watched client, which is what
 * tells the till the line is back: this function reports nothing itself.
 */
export async function probeShop(api: ApiClient, waitMs: number = PROBE_WAIT_MS): Promise<ShopFlags | null> {
  try {
    return await withTimeout(() => fetchShopFlags(api), waitMs, () => new Error('The server did not answer in time.'));
  } catch {
    return null;
  }
}

/**
 * Looks at the shop once, and hands what it says about its settings to `learn`. True when it answered. Used by the
 * look every few seconds while the line is down, and by the person's own "try the shop again".
 */
export async function lookAtShop(
  api: ApiClient,
  learn: (flags: ShopFlags) => void,
  waitMs: number = PROBE_WAIT_MS
): Promise<boolean> {
  const flags = await probeShop(api, waitMs);
  if (flags === null) return false;
  learn(flags);
  return true;
}
