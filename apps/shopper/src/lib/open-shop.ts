import { openRememberedStore, revalidateActive, switchStore, type OpenStoreResult, type StoreSnapshot } from '@kiosk/core';
import { API_BASE_URL } from './config';
import { openGate } from './open-gate';

/** `busy`: another shop is being opened right now, so nothing was started. */
export type LookedUpOutcome = 'opened' | 'blocked' | 'busy';

/**
 * Opens a shop that was just looked up and shown on a preview card. The server has already answered, so
 * this does not ask again: it makes the shop the open one, then asks the server about it in the background
 * so what a shop looked up by its address does not carry (what it offers) is filled in without a wait.
 *
 * A shopper's phone holds no unsent sales, so the switch is never held up; `blocked` is kept so a result
 * is never ignored.
 */
export async function openLookedUpStore(store: StoreSnapshot): Promise<LookedUpOutcome> {
  const outcome = await openGate.run(async () => {
    const switched = await switchStore(store);
    if (switched.kind === 'blocked') {
      return 'blocked' as const;
    }
    void revalidateActive(API_BASE_URL, { audience: 'shopper' }).catch(() => undefined);
    return 'opened' as const;
  });
  return outcome.ran ? outcome.value : 'busy';
}

/** Opens a shop this phone already knows. The answer is `busy` when another shop is being opened. */
export async function openRememberedShop(tenantId: string): Promise<OpenStoreResult | { kind: 'busy' }> {
  const outcome = await openGate.run(() => openRememberedStore(tenantId, API_BASE_URL, { audience: 'shopper' }));
  return outcome.ran ? outcome.value : { kind: 'busy' };
}
