import type { ApiClient } from '@kiosk/core';
import type { OutboxItem } from './outbox';

/**
 * Sends a queued request again, under the Idempotency-Key it was queued with.
 *
 * The stored key is the point of this function. If the first attempt reached the server but
 * its response was lost, the server already holds the result under that key and returns it
 * instead of recording the operation a second time. A fresh key per replay would defeat that.
 */
export async function replayItem(api: ApiClient, item: OutboxItem): Promise<void> {
  // An item without a stored key still goes out as an idempotent request: the client mints one.
  const options = { idempotent: true, idempotencyKey: item.idempotencyKey || undefined };

  switch (item.method) {
    case 'POST':
      await api.post(item.path, item.body, options);
      return;
    case 'PATCH':
      await api.patch(item.path, item.body, options);
      return;
    case 'DELETE':
      await api.delete(item.path, options);
      return;
    default:
      // Never report an item as sent when nothing was sent.
      throw new Error(`Cannot replay a queued ${item.method} request`);
  }
}
