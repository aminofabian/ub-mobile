import { plain, secureGet, securePut, secureRemove } from './storage';
import { ensureStorageReady } from './storage-schema';
import { plainKey, secureKey, type PlainField, type SecureField } from './storage-keys';
import { getActiveTenantId } from './tenant';

/**
 * Reads and writes the pieces of data that belong to one shop (plan §5.2). Without a tenant id they
 * act on the active shop; with no active shop a read finds nothing and a write is refused (returns
 * false), so nothing is ever stored where no shop owns it.
 */

async function resolveId(tenantId?: string): Promise<string | null> {
  return tenantId ?? (await getActiveTenantId());
}

export async function readTenantSecret(field: SecureField, tenantId?: string): Promise<string | null> {
  const id = await resolveId(tenantId);
  if (!id) return null;
  await ensureStorageReady();
  return secureGet(secureKey(id, field));
}

export async function writeTenantSecret(field: SecureField, value: string, tenantId?: string): Promise<boolean> {
  const id = await resolveId(tenantId);
  if (!id) return false;
  await ensureStorageReady();
  await securePut(secureKey(id, field), value);
  return true;
}

export async function removeTenantSecret(field: SecureField, tenantId?: string): Promise<void> {
  const id = await resolveId(tenantId);
  if (!id) return;
  await ensureStorageReady();
  await secureRemove(secureKey(id, field));
}

export async function readTenantValue(field: PlainField, tenantId?: string): Promise<string | null> {
  const id = await resolveId(tenantId);
  if (!id) return null;
  await ensureStorageReady();
  return (await plain()).get(plainKey(id, field));
}

export async function writeTenantValue(field: PlainField, value: string, tenantId?: string): Promise<boolean> {
  const id = await resolveId(tenantId);
  if (!id) return false;
  await ensureStorageReady();
  await (await plain()).set(plainKey(id, field), value);
  return true;
}

export async function removeTenantValue(field: PlainField, tenantId?: string): Promise<void> {
  const id = await resolveId(tenantId);
  if (!id) return;
  await ensureStorageReady();
  await (await plain()).remove(plainKey(id, field));
}
