import { getActiveTenantId, loadStoreById, type ApiClient } from '@kiosk/core';
import { isBeingSent, outboxFor, type Outbox, type OutboxItem } from './outbox';
import { replayItem } from './replay';
import { REFUSED, classifyReplayFailure } from './replay-failure';

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
  /** A queued request was taken by the server. `response` is what the server answered. */
  onSynced?: (item: OutboxItem, response?: unknown) => void;
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
    // A sale the screen is sending this very moment is its own to finish: a second request would race the first.
    if (isBeingSent(item.id)) return;
    if (item.retries >= maxRetries) return;
    // A sale the server refused outright stays where it is until a person looks at it: asking again cannot change the answer.
    if (item.conflictType === REFUSED) return;

    try {
      const response = await replayItem(client, item);
      await queue.remove(item.id);
      try {
        onSynced?.(item, response);
      } catch {
        // A listener that fails must not turn a sale the server has taken into a failure.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      // What the failure means is read from its status (see replay-failure.ts), never from the words of the message.
      switch (classifyReplayFailure(error)) {
        case 'conflict':
          await queue.update(item.id, { conflictType: 'sync_conflict', lastError: message });
          onConflict?.(item);
          break;
        case 'refused':
          await queue.update(item.id, { conflictType: REFUSED, lastError: message });
          onNeedsAttention?.({ ...item, conflictType: REFUSED, lastError: message });
          break;
        case 'setup':
          // Waiting for a step, not failing: no attempt used, and nothing written again while the answer is the same.
          if (item.lastError !== message) await queue.update(item.id, { lastError: message });
          break;
        case 'wait':
          // Nothing is wrong with the sale, so nothing is recorded against it.
          break;
        case 'broken':
          await queue.markRetry(item.id, message);
          if (item.retries + 1 === maxRetries) {
            onNeedsAttention?.({ ...item, retries: item.retries + 1, lastError: message });
          }
          break;
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
