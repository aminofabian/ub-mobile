import * as SecureStore from 'expo-secure-store';
import { SECURE_INDEX_KEY } from './storage-keys';

/**
 * The two stores behind the tenant layer (plan §5.2).
 *
 * `secure()` is SecureStore. `plain()` is AsyncStorage when the binary links it, and otherwise a
 * SecureStore-backed stand-in: the Admin and Grocery binaries do not declare AsyncStorage, and an
 * over-the-air update must never require a native module a live binary lacks. The stand-in keeps
 * the old behaviour (everything in SecureStore); only the "an uninstall wipes the marker" property
 * is lost there, and that matters on iOS only.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface StorageOverrides {
  secure?: KeyValueStore;
  plain?: KeyValueStore;
}

let overrides: StorageOverrides = {};
let nativeSecure: KeyValueStore | null = null;
let nativePlain: Promise<KeyValueStore> | null = null;
let indexLock: Promise<unknown> = Promise.resolve();

const resetters = new Set<() => void>();

/** Modules that keep anything in memory above the stores register here, so a cold start can be simulated. */
export function onRuntimeReset(fn: () => void): void {
  resetters.add(fn);
}

/** Forgets every in-memory cache (never the stored data), as a freshly started process would. */
export function resetRuntime(): void {
  nativeSecure = null;
  nativePlain = null;
  indexLock = Promise.resolve();
  for (const fn of resetters) {
    fn();
  }
}

/** For tests and for apps that want to hand in their own stores. Pass null to go back to the defaults. */
export function configureStorage(next: StorageOverrides | null): void {
  overrides = next ?? {};
  resetRuntime();
}

const SECURE_KEY = /^[\w.-]+$/;

function secureAdapter(): KeyValueStore {
  return {
    get: (key) => SecureStore.getItemAsync(key),
    set: (key, value) => SecureStore.setItemAsync(key, value),
    remove: (key) => SecureStore.deleteItemAsync(key),
  };
}

/**
 * Stand-in for AsyncStorage in a binary that does not link it. SecureStore rejects keys such as
 * "@kiosk/offline/outbox", so a read of one (the migration looks for the old outbox) answers
 * "nothing there" instead of throwing. Writing one is a programming error and still throws.
 */
function secureAsPlainAdapter(): KeyValueStore {
  const inner = secureAdapter();
  return {
    get: (key) => (SECURE_KEY.test(key) ? inner.get(key) : Promise.resolve(null)),
    set: (key, value) => inner.set(key, value),
    remove: (key) => (SECURE_KEY.test(key) ? inner.remove(key) : Promise.resolve()),
  };
}

export function secure(): KeyValueStore {
  if (overrides.secure) {
    return overrides.secure;
  }
  if (!nativeSecure) {
    nativeSecure = secureAdapter();
  }
  return nativeSecure;
}

/** What a binary without the native module says. Anything else from AsyncStorage is a real failure. */
const NOT_LINKED = /native\s?module|is null|not linked/i;

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

async function loadAsyncStorage(): Promise<KeyValueStore | null> {
  let storage: AsyncStorageLike | undefined;
  try {
    storage = (await import('@react-native-async-storage/async-storage')).default as AsyncStorageLike;
    await storage.getItem('kiosk.v2.probe');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The module throws while loading when the binary lacks its native half.
    if (!storage || NOT_LINKED.test(message)) {
      return null;
    }
    // A real I/O failure is not a reason to switch stores for the rest of the process.
    throw error;
  }
  const linked = storage;
  return {
    get: (key) => linked.getItem(key),
    set: (key, value) => linked.setItem(key, value),
    remove: (key) => linked.removeItem(key),
  };
}

export function plain(): Promise<KeyValueStore> {
  if (overrides.plain) {
    return Promise.resolve(overrides.plain);
  }
  if (!nativePlain) {
    const pending = loadAsyncStorage().then((storage) => storage ?? secureAsPlainAdapter());
    nativePlain = pending;
    // A failed probe is not remembered: the next call tries again.
    pending.catch(() => {
      if (nativePlain === pending) {
        nativePlain = null;
      }
    });
  }
  return nativePlain;
}

export async function readJson<T>(store: KeyValueStore, key: string): Promise<T | null> {
  const raw = await store.get(key);
  if (raw == null) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(store: KeyValueStore, key: string, value: unknown): Promise<void> {
  await store.set(key, JSON.stringify(value));
}

function withIndexLock<T>(work: () => Promise<T>): Promise<T> {
  const run = indexLock.then(work, work);
  indexLock = run.catch(() => undefined);
  return run;
}

async function readIndex(): Promise<string[]> {
  const parsed = await readJson<unknown>(secure(), SECURE_INDEX_KEY);
  return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
}

/**
 * Writes a secure value and remembers its key. SecureStore cannot list its keys, and on iOS it
 * outlives an uninstall, so the index is how a fresh install finds what the last one left.
 * The index is written first: a crash in between leaves an entry with no value, which is harmless.
 */
export async function securePut(key: string, value: string): Promise<void> {
  if (!SECURE_KEY.test(key)) {
    throw new Error('Invalid secure storage key.');
  }
  await withIndexLock(async () => {
    const index = await readIndex();
    if (!index.includes(key)) {
      index.push(key);
      await writeJson(secure(), SECURE_INDEX_KEY, index);
    }
  });
  await secure().set(key, value);
}

export function secureGet(key: string): Promise<string | null> {
  return secure().get(key);
}

export async function secureRemove(key: string): Promise<void> {
  await secure().remove(key);
  await withIndexLock(async () => {
    const index = await readIndex();
    const next = index.filter((entry) => entry !== key);
    if (next.length !== index.length) {
      await writeJson(secure(), SECURE_INDEX_KEY, next);
    }
  });
}

export function secureIndexKeys(): Promise<string[]> {
  return withIndexLock(readIndex);
}

/**
 * Deletes every secure key in the index, then the index. A key that cannot be deleted stays in the
 * index so the next boot tries again. Returns how many were removed and how many were not.
 */
export async function purgeSecureIndex(): Promise<{ removed: number; failed: number }> {
  return withIndexLock(async () => {
    const index = await readIndex();
    const remaining: string[] = [];
    let removed = 0;
    for (const key of index) {
      try {
        await secure().remove(key);
        removed += 1;
      } catch {
        remaining.push(key);
      }
    }
    if (remaining.length) {
      await writeJson(secure(), SECURE_INDEX_KEY, remaining);
    } else {
      await secure().remove(SECURE_INDEX_KEY);
    }
    return { removed, failed: remaining.length };
  });
}
