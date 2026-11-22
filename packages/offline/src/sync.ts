import { getActiveTenantId, loadStoreById, type ApiClient } from '@kiosk/core';
import { outboxFor, type Outbox, type OutboxItem } from './outbox';
import { replayItem } from './replay';

export interface SyncEngineOptions {
  api: ApiClient;
  /**
   * Send for this shop only. Without it the engine sends for whichever shop is active each time it
   * runs, and only that shop's queue is touched.
   */
  tenantId?: string;
  intervalMs?: number;
  maxRetries?: number;
  onConflict?: (item: OutboxItem) => void;
  onSynced?: (item: OutboxItem) => void;
  /** A sale has failed `maxRetries` times and will not be tried again by itself. Called once, when it gets there. */
  onNeedsAttention?: (item: OutboxItem) => void;
}

export interface SyncEngine {
  start(): void;
  stop(): void;
  sync(): Promise<void>;
}

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const { api, tenantId, intervalMs = 30_000, maxRetries = 5, onConflict, onSynced, onNeedsAttention } = options;
  let timer: ReturnType<typeof setInterval> | null = null;
  let running: Promise<void> | null = null;

  /**
   * What one shop's sales are sent through: a client pinned to that shop, so switching shops while a
   * request is on its way cannot send the sale with another shop's headers and session. A client that
   * cannot be pinned is used as it is, and the loop below watches the active shop instead.
   */
  function clientFor(shop: string): { client: ApiClient; pinned: boolean } {
    if (api.tenantId === shop) {
      return { client: api, pinned: true };
    }
    const bound = api.forTenant?.(shop);
    return bound ? { client: bound, pinned: true } : { client: api, pinned: false };
  }

  async function processItem(queue: Outbox, client: ApiClient, item: OutboxItem): Promise<void> {
    if (item.retries >= maxRetries) return;

    try {
      await replayItem(client, item);
      await queue.remove(item.id);
      onSynced?.(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      const isConflict = message.includes('409') || message.includes('conflict');
      if (isConflict) {
        await queue.update(item.id, { conflictType: 'sync_conflict', lastError: message });
        onConflict?.(item);
      } else {
        await queue.markRetry(item.id, message);
        if (item.retries + 1 === maxRetries) {
          onNeedsAttention?.({ ...item, retries: item.retries + 1, lastError: message });
        }
      }
    }
  }

  async function drain(): Promise<void> {
    const named = tenantId ?? api.tenantId;
    const shop = named ?? (await getActiveTenantId());
    if (!shop) return;
    // A shop this phone has forgotten has no session to send with.
    if (named && !(await loadStoreById(shop))) return;

    const queue = outboxFor(shop);
    const { client, pinned } = clientFor(shop);
    for (const item of await queue.pending()) {
      if (!pinned && (await getActiveTenantId()) !== shop) return;
      // Never send a sale to a shop it does not belong to.
      if (item.tenantId && item.tenantId !== shop) continue;
      await processItem(queue, client, item);
    }
  }

  /** One pass at a time: a timer tick and a manual sync that overlap would send every sale twice. */
  function sync(): Promise<void> {
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
        void sync().catch(() => undefined);
      }, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    sync,
  };
}

// Default no-op engine for apps that haven't wired sync yet
export const syncEngine: SyncEngine = {
  start() {},
  stop() {},
  async sync() {},
};
