import {
  ensureStorageReady,
  getActiveTenantId,
  isProvisionalId,
  loadActiveStore,
  loadStoreById,
  outboxKey,
  provisionalId,
  unreadableOutboxKey,
  withOutboxLock,
  type UnsentSummary,
} from '@kiosk/core';

export interface OutboxItem {
  id: string;
  method: string;
  path: string;
  body: unknown;
  idempotencyKey: string;
  retries: number;
  createdAt: string;
  lastError?: string;
  conflictType?: string;
  /** The shop this request belongs to. Set when it is queued; sales queued before shops were kept apart get it when they are carried over. */
  tenantId?: string;
}

export interface Outbox {
  enqueue(item: Omit<OutboxItem, 'retries' | 'createdAt'>): Promise<void>;
  pending(): Promise<OutboxItem[]>;
  remove(id: string): Promise<void>;
  markRetry(id: string, error?: string): Promise<void>;
  update(id: string, patch: Partial<OutboxItem>): Promise<void>;
}

export interface OutboxChange {
  tenantId: string;
}

/** After this many failed attempts, or a conflict, a sale stops being "waiting" and needs a person. The Conflicts screen lists these. */
export const ATTENTION_AFTER_RETRIES = 3;

export function needsAttention(item: OutboxItem): boolean {
  return Boolean(item.conflictType) || item.retries >= ATTENTION_AFTER_RETRIES;
}

// ---------------------------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------------------------

interface RawStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

let storage: Promise<RawStorage> | null = null;

async function loadStorage(): Promise<RawStorage> {
  try {
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    return AsyncStorage.default;
  } catch {
    // Not linked in this build. Keep the queue in memory, one list per key, rather than fail every sale.
    const memory = new Map<string, string>();
    return {
      getItem: async (key) => memory.get(key) ?? null,
      setItem: async (key, value) => {
        memory.set(key, value);
      },
      removeItem: async (key) => {
        memory.delete(key);
      },
    };
  }
}

function getStorage(): Promise<RawStorage> {
  if (!storage) {
    storage = loadStorage();
  }
  return storage;
}

function isItem(value: unknown): value is OutboxItem {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.method === 'string' && typeof item.path === 'string';
}

/**
 * A shop's queue. Whatever cannot be read is never thrown away: with `keepUnreadable` the original
 * text is saved beside the queue (the first time only) so a person can still get at it, and the queue
 * carries on with the entries that are intact. Without it nothing is written, so a plain read stays
 * a read.
 */
async function readItems(tenantId: string, options: { keepUnreadable: boolean }): Promise<OutboxItem[]> {
  const store = await getStorage();
  const raw = await store.getItem(outboxKey(tenantId));
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  const items = Array.isArray(parsed) ? parsed.filter(isItem) : [];
  const intact = Array.isArray(parsed) && items.length === parsed.length;
  if (!intact && options.keepUnreadable) {
    const keep = unreadableOutboxKey(tenantId);
    if ((await store.getItem(keep)) === null) {
      await store.setItem(keep, raw);
    }
  }
  return items;
}

async function writeItems(tenantId: string, items: OutboxItem[]): Promise<void> {
  const store = await getStorage();
  if (items.length === 0) {
    await store.removeItem(outboxKey(tenantId));
  } else {
    await store.setItem(outboxKey(tenantId), JSON.stringify(items));
  }
}

// ---------------------------------------------------------------------------------------------
// Which shop
// ---------------------------------------------------------------------------------------------

/**
 * A shop carried over from the old layout is called `pending-<slug>` until the server confirms it, and
 * then its queue moves to the real id. A caller that took the old name just before that must still end
 * up in the right queue, so a provisional name that no longer exists is read as the active shop it became.
 */
async function currentId(id: string): Promise<string> {
  if (!isProvisionalId(id) || (await loadStoreById(id))) {
    return id;
  }
  const active = await loadActiveStore();
  return active && provisionalId(active.slug) === id ? active.businessId : id;
}

async function resolveId(target: string | undefined): Promise<string | null> {
  return target === undefined ? getActiveTenantId() : currentId(target);
}

// ---------------------------------------------------------------------------------------------
// Changes and who hears about them
// ---------------------------------------------------------------------------------------------

const listeners = new Set<(change: OutboxChange) => void>();

/** Called after any change to any shop's queue. Returns the unsubscribe. */
export function subscribeOutbox(listener: (change: OutboxChange) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(tenantId: string): void {
  for (const listener of [...listeners]) {
    try {
      listener({ tenantId });
    } catch {
      // A listener that throws must not stop the others.
    }
  }
}

type Edit = (items: OutboxItem[], tenantId: string) => OutboxItem[] | null | Promise<OutboxItem[] | null>;

/**
 * Reads a shop's queue, lets `change` edit it and writes it back, all while holding the queue lock, so
 * no other change can slip between the read and the write. `change` returns the new list, or null to
 * leave the queue alone. The shop is worked out inside the lock for the same reason.
 */
async function edit(target: string | undefined, change: Edit, options: { needShop?: boolean } = {}): Promise<void> {
  await ensureStorageReady();
  const changed = await withOutboxLock(async () => {
    const id = await resolveId(target);
    if (!id) {
      if (options.needShop) {
        throw new Error('Select a store first before queuing a sale.');
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

function makeOutbox(target: string | undefined): Outbox {
  return {
    async enqueue(item) {
      await edit(
        target,
        async (items, id) => {
          if (item.tenantId && (await currentId(item.tenantId)) !== id) {
            throw new Error('That sale belongs to a different store than the queue it was added to.');
          }
          if (!(await loadStoreById(id))) {
            throw new Error('That store is no longer on this phone.');
          }
          if (items.some((queued) => queued.id === item.id)) {
            return null; // already queued; the first copy stays
          }
          return [...items, { ...item, tenantId: id, retries: 0, createdAt: new Date().toISOString() }];
        },
        { needShop: true },
      );
    },
    async pending() {
      await ensureStorageReady();
      const id = await resolveId(target);
      return id ? readItems(id, { keepUnreadable: false }) : [];
    },
    async remove(id) {
      await edit(target, (items) => (items.some((i) => i.id === id) ? items.filter((i) => i.id !== id) : null));
    },
    async markRetry(id, error) {
      await edit(target, (items) =>
        items.some((i) => i.id === id)
          ? items.map((i) => (i.id === id ? { ...i, retries: i.retries + 1, lastError: error } : i))
          : null,
      );
    },
    async update(id, patch) {
      await edit(target, (items) =>
        items.some((i) => i.id === id) ? items.map((i) => (i.id === id ? { ...i, ...patch } : i)) : null,
      );
    },
  };
}

/** One shop's queue, whichever shop is active. What a sync engine for that shop uses. */
export function outboxFor(tenantId: string): Outbox {
  outboxKey(tenantId); // an id that cannot be a shop is refused here, not on the first write
  return makeOutbox(tenantId);
}

/** The active shop's queue. It follows the active shop: each call is for whichever shop is active at that moment. */
export const outbox: Outbox = makeOutbox(undefined);

// ---------------------------------------------------------------------------------------------
// What the rest of the app needs to know about a queue
// ---------------------------------------------------------------------------------------------

/** How many sales a shop has not sent, and how many of those need a person. Defaults to the active shop. */
export async function summarizeOutbox(tenantId?: string): Promise<UnsentSummary> {
  const items = await (tenantId === undefined ? outbox : outboxFor(tenantId)).pending();
  return { total: items.length, needsAttention: items.filter(needsAttention).length };
}

/** Lets every sale that stopped sending by itself try again. Returns how many. */
export async function retryStuck(tenantId?: string): Promise<number> {
  let count = 0;
  await edit(tenantId, (items) => {
    count = items.filter(needsAttention).length;
    if (count === 0) {
      return null;
    }
    return items.map((item) =>
      needsAttention(item) ? { ...item, retries: 0, conflictType: undefined, lastError: undefined } : item,
    );
  });
  return count;
}

/** A shop's queue as text, for a person to keep or send to support when a sale will not go through. */
export async function exportOutbox(tenantId?: string): Promise<string> {
  await ensureStorageReady();
  const id = tenantId === undefined ? await getActiveTenantId() : await currentId(tenantId);
  const items = id ? await readItems(id, { keepUnreadable: false }) : [];
  const unreadable = id ? await (await getStorage()).getItem(unreadableOutboxKey(id)) : null;
  return JSON.stringify(
    { tenantId: id, exportedAt: new Date().toISOString(), items, ...(unreadable ? { unreadable } : {}) },
    null,
    2,
  );
}
