const STORAGE_PREFIX = '@kiosk/offline/';

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
};

let storage: StorageAdapter | null = null;

async function getStorage(): Promise<StorageAdapter> {
  if (storage) return storage;
  try {
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    storage = {
      getItem: (key) => AsyncStorage.default.getItem(key),
      setItem: (key, value) => AsyncStorage.default.setItem(key, value),
      removeItem: (key) => AsyncStorage.default.removeItem(key),
      getAllKeys: () => AsyncStorage.default.getAllKeys(),
    };
  } catch {
    const memory = new Map<string, string>();
    storage = {
      getItem: async (key) => memory.get(key) ?? null,
      setItem: async (key, value) => {
        memory.set(key, value);
      },
      removeItem: async (key) => {
        memory.delete(key);
      },
      getAllKeys: async () => [...memory.keys()],
    };
  }
  return storage;
}

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export const cache: Cache = {
  async get<T>(key: string): Promise<T | null> {
    const store = await getStorage();
    const raw = await store.getItem(`${STORAGE_PREFIX}cache/${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async set<T>(key: string, value: T): Promise<void> {
    const store = await getStorage();
    await store.setItem(`${STORAGE_PREFIX}cache/${key}`, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    const store = await getStorage();
    await store.removeItem(`${STORAGE_PREFIX}cache/${key}`);
  },
  async clear(): Promise<void> {
    const store = await getStorage();
    const keys = await store.getAllKeys();
    await Promise.all(
      keys.filter((k) => k.startsWith(`${STORAGE_PREFIX}cache/`)).map((k) => store.removeItem(k))
    );
  },
};

const SCHEMA_VERSION_KEY = `${STORAGE_PREFIX}meta/schemaVersion`;

export async function getLocalSchemaVersion(): Promise<number> {
  const store = await getStorage();
  const raw = await store.getItem(SCHEMA_VERSION_KEY);
  return raw ? Number(raw) : 1;
}

export async function setLocalSchemaVersion(version: number): Promise<void> {
  const store = await getStorage();
  await store.setItem(SCHEMA_VERSION_KEY, String(version));
}
