import { removeTenantValue } from '@kiosk/core';
import { usePosStore } from '../store/pos-store';
import { emptyBook } from './holds';
import { dropCatalogCopies } from './catalog-storage';
import { dropHoldKeeper } from './hold-storage';

/**
 * What this phone kept for a shop that has taken it off as a till: the price list (with its stock), what the shop said a
 * till may do, and the baskets on hold. Sales that were never sent stay, and so does the till's log: both are what a
 * manager needs to deal with the sales, and neither says anything about the shop's stock. Never fails.
 */
export async function forgetTillData(tenantId: string): Promise<void> {
  dropCatalogCopies(tenantId);
  dropHoldKeeper(tenantId);
  usePosStore.setState({ holds: emptyBook(), holdsFor: null });
  for (const field of ['catalog', 'shopFlags', 'heldBaskets'] as const) {
    try {
      await removeTenantValue(field, tenantId);
    } catch {
      // Storage trouble: what could not be removed ages out by itself (flags in a week, baskets in a day).
    }
  }
}
