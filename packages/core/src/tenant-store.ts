import {
  ACTIVE_TENANT_KEY,
  PROVISIONAL_KEY,
  RECENT_LIMIT,
  RECENT_TENANTS_KEY,
  assertTenantId,
  snapshotKey,
} from './storage-keys';
import { readJson, writeJson, type KeyValueStore } from './storage';
import type { StoreSnapshot } from './tenant-types';

/**
 * Low-level reads and writes of the tenant records in the plain store. No readiness checks and no
 * caching here: tenant.ts owns those. Everything takes the store as an argument.
 */

function isSnapshot(value: unknown): value is StoreSnapshot {
  const v = value as Partial<StoreSnapshot> | null;
  return Boolean(
    v &&
      typeof v.businessId === 'string' &&
      typeof v.slug === 'string' &&
      typeof v.host === 'string' &&
      typeof v.displayName === 'string',
  );
}

export async function readSnapshot(store: KeyValueStore, tenantId: string): Promise<StoreSnapshot | null> {
  const parsed = await readJson<unknown>(store, snapshotKey(tenantId));
  return isSnapshot(parsed) ? { ...parsed, branding: parsed.branding ?? {} } : null;
}

export async function writeSnapshot(store: KeyValueStore, snapshot: StoreSnapshot): Promise<void> {
  assertTenantId(snapshot.businessId);
  await writeJson(store, snapshotKey(snapshot.businessId), snapshot);
}

export async function removeSnapshot(store: KeyValueStore, tenantId: string): Promise<void> {
  await store.remove(snapshotKey(tenantId));
}

export async function readPointer(store: KeyValueStore): Promise<string | null> {
  const raw = await store.get(ACTIVE_TENANT_KEY);
  const id = raw?.trim();
  return id ? id : null;
}

export async function writePointer(store: KeyValueStore, tenantId: string | null): Promise<void> {
  if (tenantId === null) {
    await store.remove(ACTIVE_TENANT_KEY);
    return;
  }
  await store.set(ACTIVE_TENANT_KEY, assertTenantId(tenantId));
}

export async function readRecents(store: KeyValueStore): Promise<string[]> {
  const parsed = await readJson<unknown>(store, RECENT_TENANTS_KEY);
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
}

export async function writeRecents(store: KeyValueStore, ids: string[]): Promise<void> {
  await writeJson(store, RECENT_TENANTS_KEY, ids.slice(0, RECENT_LIMIT));
}

/** Puts a tenant first. The store that falls off the end loses its card, not its data. */
export async function rememberTenant(store: KeyValueStore, tenantId: string): Promise<void> {
  const ids = await readRecents(store);
  await writeRecents(store, [tenantId, ...ids.filter((id) => id !== tenantId)]);
}

export async function readProvisional(store: KeyValueStore): Promise<Record<string, string>> {
  const parsed = await readJson<unknown>(store, PROVISIONAL_KEY);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export async function writeProvisional(store: KeyValueStore, map: Record<string, string>): Promise<void> {
  if (Object.keys(map).length === 0) {
    await store.remove(PROVISIONAL_KEY);
    return;
  }
  await writeJson(store, PROVISIONAL_KEY, map);
}
