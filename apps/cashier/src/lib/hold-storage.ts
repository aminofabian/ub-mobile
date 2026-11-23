import { readTenantValue, writeTenantValue } from '@kiosk/core';
import { createHoldKeeper, type HoldKeeper } from './hold-keeper';

const keepers = new Map<string, HoldKeeper>();

/**
 * The one keeper of a shop's held baskets on this phone. Every screen shares it, so two saves never overlap and the
 * last one asked for is the last one written.
 */
export function holdKeeperFor(tenantId: string): HoldKeeper {
  let keeper = keepers.get(tenantId);
  if (!keeper) {
    keeper = createHoldKeeper({
      read: () => readTenantValue('heldBaskets', tenantId),
      write: (value) => writeTenantValue('heldBaskets', value, tenantId),
    });
    keepers.set(tenantId, keeper);
  }
  return keeper;
}
