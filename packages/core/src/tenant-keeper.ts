import { createKeeper, type Keeper } from './keeper';
import type { PlainField } from './storage-keys';
import { readTenantValue, removeTenantValue, writeTenantValue } from './tenant-data';

/**
 * The one keeper of a piece of a shop's data on this phone. Every screen of an app asks for it by name and gets the same
 * one, so two saves never overlap and what one screen changed is what another sees. It is made once per shop and field,
 * and let go when the phone stops working for that shop.
 */

export type KeeperCodec<T> = {
  initial: T;
  parse: (text: string | null, now: number) => T;
  /** The text to keep, or null when there is nothing worth keeping (what was kept is then removed). */
  serialize: (value: T) => string | null;
};

const keepers = new Map<string, Keeper<unknown>>();

function keyOf(tenantId: string, field: PlainField): string {
  return `${tenantId}\u0000${field}`;
}

export function tenantKeeper<T>(field: PlainField, tenantId: string, codec: KeeperCodec<T>): Keeper<T> {
  const key = keyOf(tenantId, field);
  const existing = keepers.get(key);
  if (existing) return existing as Keeper<T>;
  const keeper = createKeeper<T>({
    initial: codec.initial,
    parse: codec.parse,
    serialize: codec.serialize,
    storage: {
      read: () => readTenantValue(field, tenantId),
      write: async (value) => {
        if (value === null) {
          await removeTenantValue(field, tenantId);
          return true;
        }
        return writeTenantValue(field, value, tenantId);
      },
    },
  });
  keepers.set(key, keeper as Keeper<unknown>);
  return keeper;
}

/** Lets go of what is held in memory for a shop. What is kept on the phone is not touched. */
export function dropTenantKeepers(tenantId: string): void {
  const prefix = `${tenantId}\u0000`;
  for (const key of [...keepers.keys()]) {
    if (key.startsWith(prefix)) keepers.delete(key);
  }
}
