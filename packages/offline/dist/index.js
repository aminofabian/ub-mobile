"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ATTENTION_AFTER_RETRIES: () => ATTENTION_AFTER_RETRIES,
  EXPORT_ERROR_LIMIT: () => EXPORT_ERROR_LIMIT,
  EXPORT_UNREADABLE_LIMIT: () => EXPORT_UNREADABLE_LIMIT,
  REFUSED: () => REFUSED,
  SENDING_LEASE_MS: () => SENDING_LEASE_MS,
  STORED_ERROR_LIMIT: () => STORED_ERROR_LIMIT,
  cache: () => cache,
  checkMobileSchemaVersion: () => checkMobileSchemaVersion,
  classifyReplayFailure: () => classifyReplayFailure,
  clipText: () => clipText,
  createSyncEngine: () => createSyncEngine,
  exportOutbox: () => exportOutbox,
  getLocalSchemaVersion: () => getLocalSchemaVersion,
  holdWhileSending: () => holdWhileSending,
  isBeingSent: () => isBeingSent,
  needsAttention: () => needsAttention,
  outbox: () => outbox,
  outboxFor: () => outboxFor,
  replayItem: () => replayItem,
  retryStuck: () => retryStuck,
  setLocalSchemaVersion: () => setLocalSchemaVersion,
  storedError: () => storedError,
  subscribeOutbox: () => subscribeOutbox,
  summarizeOutbox: () => summarizeOutbox,
  syncEngine: () => syncEngine
});
module.exports = __toCommonJS(index_exports);
var import_core4 = require("@kiosk/core");

// src/outbox.ts
var import_core = require("@kiosk/core");
var ATTENTION_AFTER_RETRIES = 3;
var STORED_ERROR_LIMIT = 300;
function storedError(text) {
  if (text === void 0) return void 0;
  const trimmed = text.trim();
  if (trimmed.startsWith("<")) return "The server sent a web page instead of an answer.";
  const characters = Array.from(trimmed);
  return characters.length <= STORED_ERROR_LIMIT ? trimmed : `${characters.slice(0, STORED_ERROR_LIMIT).join("")}\u2026`;
}
function needsAttention(item) {
  return Boolean(item.conflictType) || item.retries >= ATTENTION_AFTER_RETRIES;
}
var storage = null;
async function loadStorage() {
  try {
    const AsyncStorage = await import("@react-native-async-storage/async-storage");
    return AsyncStorage.default;
  } catch {
    const memory = /* @__PURE__ */ new Map();
    return {
      getItem: async (key) => memory.get(key) ?? null,
      setItem: async (key, value) => {
        memory.set(key, value);
      },
      removeItem: async (key) => {
        memory.delete(key);
      }
    };
  }
}
function getStorage() {
  if (!storage) {
    storage = loadStorage();
  }
  return storage;
}
function isItem(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value;
  return typeof item.id === "string" && typeof item.method === "string" && typeof item.path === "string";
}
async function readItems(tenantId, options) {
  const store = await getStorage();
  const raw = await store.getItem((0, import_core.outboxKey)(tenantId));
  if (!raw) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = void 0;
  }
  const items = Array.isArray(parsed) ? parsed.filter(isItem) : [];
  const intact = Array.isArray(parsed) && items.length === parsed.length;
  if (!intact && options.keepUnreadable) {
    const keep = (0, import_core.unreadableOutboxKey)(tenantId);
    if (await store.getItem(keep) === null) {
      await store.setItem(keep, raw);
    }
  }
  return items;
}
async function writeItems(tenantId, items) {
  const store = await getStorage();
  if (items.length === 0) {
    await store.removeItem((0, import_core.outboxKey)(tenantId));
  } else {
    await store.setItem((0, import_core.outboxKey)(tenantId), JSON.stringify(items));
  }
}
async function currentId(id) {
  if (!(0, import_core.isProvisionalId)(id) || await (0, import_core.loadStoreById)(id)) {
    return id;
  }
  const active = await (0, import_core.loadActiveStore)();
  return active && (0, import_core.provisionalId)(active.slug) === id ? active.businessId : id;
}
async function resolveId(target) {
  return target === void 0 ? (0, import_core.getActiveTenantId)() : currentId(target);
}
var SENDING_LEASE_MS = 6e4;
var sending = /* @__PURE__ */ new Map();
function holdWhileSending(id, now = Date.now) {
  const until = now() + SENDING_LEASE_MS;
  sending.set(id, until);
  return () => {
    if (sending.get(id) === until) sending.delete(id);
  };
}
function isBeingSent(id, now = Date.now) {
  const until = sending.get(id);
  if (until === void 0) return false;
  if (now() >= until) {
    sending.delete(id);
    return false;
  }
  return true;
}
var listeners = /* @__PURE__ */ new Set();
function subscribeOutbox(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function notify(tenantId) {
  for (const listener of [...listeners]) {
    try {
      listener({ tenantId });
    } catch {
    }
  }
}
async function edit(target, change, options = {}) {
  await (0, import_core.ensureStorageReady)();
  const changed = await (0, import_core.withOutboxLock)(async () => {
    const id = await resolveId(target);
    if (!id) {
      if (options.needShop) {
        throw new Error("Select a store first before queuing a sale.");
      }
      return null;
    }
    const next = await change(await readItems(id, { keepUnreadable: true }), id);
    if (!next) {
      return null;
    }
    await writeItems(id, next);
    return id;
  });
  if (changed) {
    notify(changed);
  }
}
function makeOutbox(target) {
  return {
    async enqueue(item) {
      await edit(
        target,
        async (items, id) => {
          if (item.tenantId && await currentId(item.tenantId) !== id) {
            throw new Error("That sale belongs to a different store than the queue it was added to.");
          }
          if (!await (0, import_core.loadStoreById)(id)) {
            throw new Error("That store is no longer on this phone.");
          }
          if (items.some((queued) => queued.id === item.id)) {
            return null;
          }
          return [...items, { ...item, tenantId: id, retries: 0, createdAt: (/* @__PURE__ */ new Date()).toISOString() }];
        },
        { needShop: true }
      );
    },
    async pending() {
      await (0, import_core.ensureStorageReady)();
      const id = await resolveId(target);
      return id ? readItems(id, { keepUnreadable: false }) : [];
    },
    async remove(id) {
      await edit(target, (items) => items.some((i) => i.id === id) ? items.filter((i) => i.id !== id) : null);
    },
    async markRetry(id, error) {
      await edit(
        target,
        (items) => items.some((i) => i.id === id) ? items.map((i) => i.id === id ? { ...i, retries: i.retries + 1, lastError: storedError(error) } : i) : null
      );
    },
    async update(id, patch) {
      const safe = "lastError" in patch ? { ...patch, lastError: storedError(patch.lastError) } : patch;
      await edit(
        target,
        (items) => items.some((i) => i.id === id) ? items.map((i) => i.id === id ? { ...i, ...safe } : i) : null
      );
    }
  };
}
function outboxFor(tenantId) {
  (0, import_core.outboxKey)(tenantId);
  return makeOutbox(tenantId);
}
var outbox = makeOutbox(void 0);
async function summarizeOutbox(tenantId) {
  const items = await (tenantId === void 0 ? outbox : outboxFor(tenantId)).pending();
  return { total: items.length, needsAttention: items.filter(needsAttention).length };
}
async function retryStuck(tenantId) {
  let count = 0;
  await edit(tenantId, (items) => {
    count = items.filter(needsAttention).length;
    if (count === 0) {
      return null;
    }
    return items.map(
      (item) => needsAttention(item) ? { ...item, retries: 0, conflictType: void 0, lastError: void 0 } : item
    );
  });
  return count;
}
var EXPORT_ERROR_LIMIT = 300;
var EXPORT_UNREADABLE_LIMIT = 2e4;
function clipText(text, limit) {
  if (text.length <= limit) return text;
  const characters = Array.from(text);
  if (characters.length <= limit) return text;
  const left = characters.length - limit;
  return `${characters.slice(0, limit).join("")}... (${left} more ${left === 1 ? "character" : "characters"} not copied)`;
}
async function exportOutbox(tenantId) {
  await (0, import_core.ensureStorageReady)();
  const id = tenantId === void 0 ? await (0, import_core.getActiveTenantId)() : await currentId(tenantId);
  const items = (id ? await readItems(id, { keepUnreadable: false }) : []).map(
    (item) => typeof item.lastError === "string" ? { ...item, lastError: clipText(item.lastError, EXPORT_ERROR_LIMIT) } : item
  );
  const stored = id ? await (await getStorage()).getItem((0, import_core.unreadableOutboxKey)(id)) : null;
  const unreadable = stored ? clipText(stored, EXPORT_UNREADABLE_LIMIT) : null;
  return JSON.stringify(
    { tenantId: id, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), items, ...unreadable ? { unreadable } : {} },
    null,
    2
  );
}

// src/sync.ts
var import_core3 = require("@kiosk/core");

// src/replay.ts
async function replayItem(api, item) {
  const options = { idempotent: true, idempotencyKey: item.idempotencyKey || void 0 };
  switch (item.method) {
    case "POST":
      return api.post(item.path, item.body, options);
    case "PATCH":
      return api.patch(item.path, item.body, options);
    case "DELETE":
      return api.delete(item.path, options);
    default:
      throw new Error(`Cannot replay a queued ${item.method} request`);
  }
}

// src/replay-failure.ts
var import_core2 = require("@kiosk/core");
var REFUSED = "refused";
function isDataIntegrity(error) {
  return typeof error.type === "string" && /(^|[:/])data-integrity$/.test(error.type);
}
function classifyReplayFailure(error) {
  if (!(0, import_core2.isApiError)(error)) return "wait";
  if ((0, import_core2.asSetupRequired)(error)) return "setup";
  const { status } = error;
  if (status === 401 || status === 408 || status === 423 || status === 429) return "wait";
  if (status === 502 || status === 503 || status === 504 || status >= 520 && status <= 524) return "wait";
  if (status === 409) return "conflict";
  if (status === 400 && isDataIntegrity(error)) return "broken";
  if (status >= 400 && status < 500) return error.foreign ? "broken" : "refused";
  return "broken";
}

// src/sync.ts
function createSyncEngine(options) {
  const { api, tenantId, intervalMs = 3e4, maxRetries = 5, onConflict, onSynced, onNeedsAttention } = options;
  let timer = null;
  let running = null;
  function clientFor(shop) {
    if (api.tenantId === shop) {
      return { client: api, pinned: true };
    }
    const bound = api.forTenant?.(shop);
    return bound ? { client: bound, pinned: true } : { client: api, pinned: false };
  }
  async function processItem(queue, client, item) {
    if (isBeingSent(item.id)) return;
    if (item.retries >= maxRetries) return;
    if (item.conflictType === REFUSED) return;
    try {
      const response = await replayItem(client, item);
      await queue.remove(item.id);
      try {
        onSynced?.(item, response);
      } catch {
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      switch (classifyReplayFailure(error)) {
        case "conflict":
          await queue.update(item.id, { conflictType: "sync_conflict", lastError: message });
          onConflict?.(item);
          break;
        case "refused":
          await queue.update(item.id, { conflictType: REFUSED, lastError: message });
          onNeedsAttention?.({ ...item, conflictType: REFUSED, lastError: message });
          break;
        case "setup":
          if (item.lastError !== message) await queue.update(item.id, { lastError: message });
          break;
        case "wait":
          break;
        case "broken":
          await queue.markRetry(item.id, message);
          if (item.retries + 1 === maxRetries) {
            onNeedsAttention?.({ ...item, retries: item.retries + 1, lastError: message });
          }
          break;
      }
    }
  }
  async function drain() {
    const named = tenantId ?? api.tenantId;
    const shop = named ?? await (0, import_core3.getActiveTenantId)();
    if (!shop) return;
    if (named && !await (0, import_core3.loadStoreById)(shop)) return;
    const queue = outboxFor(shop);
    const { client, pinned } = clientFor(shop);
    for (const item of await queue.pending()) {
      if (!pinned && await (0, import_core3.getActiveTenantId)() !== shop) return;
      if (item.tenantId && item.tenantId !== shop) continue;
      await processItem(queue, client, item);
    }
  }
  function sync() {
    if (!running) {
      running = drain().finally(() => {
        running = null;
      });
    }
    return running;
  }
  return {
    start() {
      if (timer) return;
      timer = setInterval(() => {
        void sync().catch(() => void 0);
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

// src/index.ts
(0, import_core4.registerUnsentProbe)((tenantId) => summarizeOutbox(tenantId));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ATTENTION_AFTER_RETRIES,
  EXPORT_ERROR_LIMIT,
  EXPORT_UNREADABLE_LIMIT,
  REFUSED,
  SENDING_LEASE_MS,
  STORED_ERROR_LIMIT,
  cache,
  checkMobileSchemaVersion,
  classifyReplayFailure,
  clipText,
  createSyncEngine,
  exportOutbox,
  getLocalSchemaVersion,
  holdWhileSending,
  isBeingSent,
  needsAttention,
  outbox,
  outboxFor,
  replayItem,
  retryStuck,
  setLocalSchemaVersion,
  storedError,
  subscribeOutbox,
  summarizeOutbox,
  syncEngine
});
