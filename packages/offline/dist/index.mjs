// src/outbox.ts
var OUTBOX_KEY = "@kiosk/offline/outbox";
var storage = null;
async function getStorage() {
  if (storage) return storage;
  try {
    const AsyncStorage = await import("@react-native-async-storage/async-storage");
    storage = AsyncStorage.default;
  } catch {
    let value = null;
    storage = {
      getItem: async () => value,
      setItem: async (_key, v) => {
        value = v;
      }
    };
  }
  return storage;
}
async function readOutbox() {
  const store = await getStorage();
  const raw = await store.getItem(OUTBOX_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function writeOutbox(items) {
  const store = await getStorage();
  await store.setItem(OUTBOX_KEY, JSON.stringify(items));
}
var outbox = {
  async enqueue(item) {
    const items = await readOutbox();
    items.push({
      ...item,
      retries: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await writeOutbox(items);
  },
  async pending() {
    return readOutbox();
  },
  async remove(id) {
    const items = await readOutbox();
    await writeOutbox(items.filter((i) => i.id !== id));
  },
  async markRetry(id, error) {
    const items = await readOutbox();
    const idx = items.findIndex((i) => i.id === id);
    if (idx >= 0) {
      items[idx] = {
        ...items[idx],
        retries: items[idx].retries + 1,
        lastError: error
      };
      await writeOutbox(items);
    }
  },
  async update(id, patch) {
    const items = await readOutbox();
    const idx = items.findIndex((i) => i.id === id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...patch };
      await writeOutbox(items);
    }
  }
};

// src/sync.ts
function createSyncEngine(options) {
  const { api, intervalMs = 3e4, maxRetries = 5, onConflict, onSynced } = options;
  let timer = null;
  async function processItem(item) {
    if (item.retries >= maxRetries) return;
    try {
      if (item.method === "POST") {
        await api.post(item.path, item.body, { idempotent: true });
      } else if (item.method === "PATCH") {
        await api.patch(item.path, item.body, { idempotent: true });
      } else if (item.method === "DELETE") {
        await api.delete(item.path, { idempotent: true });
      }
      await outbox.remove(item.id);
      onSynced?.(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      const isConflict = message.includes("409") || message.includes("conflict");
      if (isConflict) {
        await outbox.update(item.id, { conflictType: "sync_conflict", lastError: message });
        onConflict?.(item);
      } else {
        await outbox.markRetry(item.id, message);
      }
    }
  }
  async function sync() {
    const pending = await outbox.pending();
    for (const item of pending) {
      await processItem(item);
    }
  }
  return {
    start() {
      if (timer) return;
      timer = setInterval(() => {
        void sync();
      }, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    sync
  };
}
var syncEngine = {
  start() {
  },
  stop() {
  },
  async sync() {
  }
};

// src/cache.ts
var STORAGE_PREFIX = "@kiosk/offline/";
var storage2 = null;
async function getStorage2() {
  if (storage2) return storage2;
  try {
    const AsyncStorage = await import("@react-native-async-storage/async-storage");
    storage2 = {
      getItem: (key) => AsyncStorage.default.getItem(key),
      setItem: (key, value) => AsyncStorage.default.setItem(key, value),
      removeItem: (key) => AsyncStorage.default.removeItem(key),
      getAllKeys: () => AsyncStorage.default.getAllKeys()
    };
  } catch {
    const memory = /* @__PURE__ */ new Map();
    storage2 = {
      getItem: async (key) => memory.get(key) ?? null,
      setItem: async (key, value) => {
        memory.set(key, value);
      },
      removeItem: async (key) => {
        memory.delete(key);
      },
      getAllKeys: async () => [...memory.keys()]
    };
  }
  return storage2;
}
var cache = {
  async get(key) {
    const store = await getStorage2();
    const raw = await store.getItem(`${STORAGE_PREFIX}cache/${key}`);
    return raw ? JSON.parse(raw) : null;
  },
  async set(key, value) {
    const store = await getStorage2();
    await store.setItem(`${STORAGE_PREFIX}cache/${key}`, JSON.stringify(value));
  },
  async remove(key) {
    const store = await getStorage2();
    await store.removeItem(`${STORAGE_PREFIX}cache/${key}`);
  },
  async clear() {
    const store = await getStorage2();
    const keys = await store.getAllKeys();
    await Promise.all(
      keys.filter((k) => k.startsWith(`${STORAGE_PREFIX}cache/`)).map((k) => store.removeItem(k))
    );
  }
};
var SCHEMA_VERSION_KEY = `${STORAGE_PREFIX}meta/schemaVersion`;
async function getLocalSchemaVersion() {
  const store = await getStorage2();
  const raw = await store.getItem(SCHEMA_VERSION_KEY);
  return raw ? Number(raw) : 1;
}
async function setLocalSchemaVersion(version) {
  const store = await getStorage2();
  await store.setItem(SCHEMA_VERSION_KEY, String(version));
}

// src/schema-version.ts
async function checkMobileSchemaVersion(baseURL) {
  const response = await fetch(`${baseURL}/api/v1/platform/mobile-schema-version`);
  if (!response.ok) return null;
  const remote = await response.json();
  const local = await getLocalSchemaVersion();
  if (remote.schemaVersion > local) {
    await setLocalSchemaVersion(remote.schemaVersion);
  }
  return remote;
}
export {
  cache,
  checkMobileSchemaVersion,
  createSyncEngine,
  getLocalSchemaVersion,
  outbox,
  setLocalSchemaVersion,
  syncEngine
};
