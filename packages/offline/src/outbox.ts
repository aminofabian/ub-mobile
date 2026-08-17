const OUTBOX_KEY = '@kiosk/offline/outbox';

let storage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
} | null = null;

async function getStorage() {
  if (storage) return storage;
  try {
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    storage = AsyncStorage.default;
  } catch {
    let value: string | null = null;
    storage = {
      getItem: async () => value,
      setItem: async (_key, v) => {
        value = v;
      },
    };
  }
  return storage;
}

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
}

export interface Outbox {
  enqueue(item: Omit<OutboxItem, 'retries' | 'createdAt'>): Promise<void>;
  pending(): Promise<OutboxItem[]>;
  remove(id: string): Promise<void>;
  markRetry(id: string, error?: string): Promise<void>;
  update(id: string, patch: Partial<OutboxItem>): Promise<void>;
}

async function readOutbox(): Promise<OutboxItem[]> {
  const store = await getStorage();
  const raw = await store.getItem(OUTBOX_KEY);
  return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
}

async function writeOutbox(items: OutboxItem[]): Promise<void> {
  const store = await getStorage();
  await store.setItem(OUTBOX_KEY, JSON.stringify(items));
}

export const outbox: Outbox = {
  async enqueue(item) {
    const items = await readOutbox();
    items.push({
      ...item,
      retries: 0,
      createdAt: new Date().toISOString(),
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
        lastError: error,
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
  },
};
