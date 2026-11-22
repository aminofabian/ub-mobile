import { readTenantSecret, writeTenantSecret } from './tenant-data';
import { getActiveTenantId } from './tenant';

export const TILL_DEVICE_HEADER = 'X-Till-Device-Id';

function randomTillId(): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `till-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return rand;
}

const creating = new Map<string, Promise<string>>();

/**
 * Durable till id for shift scoping, one per shop on this phone. Empty when there is no shop (the
 * id is not made up for nobody) or storage fails.
 */
export async function getOrCreateTillDeviceId(tenantId?: string): Promise<string> {
  try {
    const id = tenantId ?? (await getActiveTenantId());
    if (!id) {
      return '';
    }
    const existing = (await readTenantSecret('tillDeviceId', id))?.trim();
    if (existing) {
      return existing;
    }
    // Requests start in parallel on a first launch; they must all get the same id.
    let pending = creating.get(id);
    if (!pending) {
      pending = (async () => {
        const again = (await readTenantSecret('tillDeviceId', id))?.trim();
        if (again) {
          return again;
        }
        const created = randomTillId();
        await writeTenantSecret('tillDeviceId', created, id);
        return created;
      })().finally(() => {
        creating.delete(id);
      });
      creating.set(id, pending);
    }
    return await pending;
  } catch {
    return '';
  }
}
