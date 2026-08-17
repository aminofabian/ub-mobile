import * as SecureStore from 'expo-secure-store';

const TILL_DEVICE_STORAGE_KEY = 'ub.tillDeviceId';
export const TILL_DEVICE_HEADER = 'X-Till-Device-Id';

function randomTillId(): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `till-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return rand;
}

/** Durable per-install till id for shift scoping. */
export async function getOrCreateTillDeviceId(): Promise<string> {
  try {
    const existing = (await SecureStore.getItemAsync(TILL_DEVICE_STORAGE_KEY))?.trim();
    if (existing) {
      return existing;
    }
    const created = randomTillId();
    await SecureStore.setItemAsync(TILL_DEVICE_STORAGE_KEY, created);
    return created;
  } catch {
    return '';
  }
}
