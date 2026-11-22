import type { ApiClient } from '@kiosk/core';
import { outbox, type OutboxItem } from './outbox';
import { replayItem } from './replay';

export interface SyncEngineOptions {
  api: ApiClient;
  intervalMs?: number;
  maxRetries?: number;
  onConflict?: (item: OutboxItem) => void;
  onSynced?: (item: OutboxItem) => void;
}

export interface SyncEngine {
  start(): void;
  stop(): void;
  sync(): Promise<void>;
}

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const { api, intervalMs = 30_000, maxRetries = 5, onConflict, onSynced } = options;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function processItem(item: OutboxItem): Promise<void> {
    if (item.retries >= maxRetries) return;

    try {
      await replayItem(api, item);
      await outbox.remove(item.id);
      onSynced?.(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      const isConflict = message.includes('409') || message.includes('conflict');
      if (isConflict) {
        await outbox.update(item.id, { conflictType: 'sync_conflict', lastError: message });
        onConflict?.(item);
      } else {
        await outbox.markRetry(item.id, message);
      }
    }
  }

  async function sync(): Promise<void> {
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
    sync,
  };
}

// Default no-op engine for apps that haven't wired sync yet
export const syncEngine: SyncEngine = {
  start() {},
  stop() {},
  async sync() {},
};
