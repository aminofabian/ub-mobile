import type { ApiClient } from '@kiosk/core';
import { holdWhileSending } from '@kiosk/offline';
import { waitFor, type ReachSink } from './reach';

/** How long the sync engine waits for one request before it stops waiting. The sale stays queued and goes again later. */
export const SYNC_REQUEST_WAIT_MS = 30_000;

/**
 * The same client, but no call is waited on for ever.
 *
 * The sync engine sends one sale at a time and goes on to the next only when the one in hand has been answered. A
 * request on a line that never answers would hold up every sale behind it and every later pass, for as long as the app
 * stays open: a phone's `fetch` has no time limit of its own.
 *
 * When the wait ends the call fails with `NotAnsweredInTime`. The engine reads that as "no answer" (try again later,
 * no attempt used) and the till is told the line may be down. The request itself is not cancelled and may still reach
 * the server and be recorded. That is safe: a queued sale is always sent under the key it was queued with, so the next
 * try is recognised as the same sale. Until the first request has really finished, the sale is marked as being sent, so
 * a pass that starts in the meantime leaves it alone. The mark lasts a minute at most (`SENDING_LEASE_MS`): a request
 * that is still out after that can be met by a second one under the same key, and the server then answers the loser
 * with a plain 400 for a sale it has recorded. That is counted as a failed attempt, not a refusal of the sale
 * (`classifyReplayFailure`), and the next try under the same key is answered with the sale that was recorded.
 */
export function boundApi(api: ApiClient, waitMs: number, sink: Pick<ReachSink, 'lost'>): ApiClient {
  const send = <T>(call: () => Promise<T>, key?: string): Promise<T> => {
    const release = key ? holdWhileSending(key) : null;
    let pending: Promise<T>;
    try {
      pending = call();
    } catch (error) {
      release?.();
      return Promise.reject(error);
    }
    // Ended by the request itself, not by the wait: the lease lasts as long as the request may still be on its way.
    if (release) pending.then(release, release);
    return waitFor(() => pending, waitMs, sink);
  };
  const forTenant = api.forTenant;
  return {
    get tenantId() {
      return api.tenantId;
    },
    ...(forTenant ? { forTenant: (tenantId: string) => boundApi(forTenant.call(api, tenantId), waitMs, sink) } : {}),
    get: <T>(path: string) => send(() => api.get<T>(path)),
    post: <T>(path: string, body?: unknown, options?: Parameters<ApiClient['post']>[2]) =>
      send(() => api.post<T>(path, body, options), options?.idempotencyKey),
    put: <T>(path: string, body?: unknown, options?: Parameters<ApiClient['put']>[2]) =>
      send(() => api.put<T>(path, body, options), options?.idempotencyKey),
    patch: <T>(path: string, body?: unknown, options?: Parameters<ApiClient['patch']>[2]) =>
      send(() => api.patch<T>(path, body, options), options?.idempotencyKey),
    delete: <T>(path: string, options?: Parameters<ApiClient['delete']>[1]) =>
      send(() => api.delete<T>(path, options), options?.idempotencyKey),
  };
}
