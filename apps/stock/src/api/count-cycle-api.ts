/**
 * The Stock app's calls for the full count (count cycle). Reads throw when the server cannot be reached and return
 * null when the answer is not what was asked for, so a failed read is never passed on as "nothing there". Writes are
 * sent once with an idempotency key; what a lost answer means is decided by the screen that sent it. Endpoints:
 * `/api/v1/inventory/stock-take/count-cycles` and its batches.
 */
import {
  generateIdempotencyKey,
  READ_TIMEOUT_MS,
  WRITE_TIMEOUT_MS,
  withTimeout,
  type ApiClient,
} from '@kiosk/core';
import { readBatch, readCycle, readHome, type Batch, type CountCycle, type CycleHome } from '../lib/count-cycle';

const BASE = '/api/v1/inventory/stock-take/count-cycles';

function read(api: ApiClient, path: string): Promise<unknown> {
  return withTimeout(api.get<unknown>(path), READ_TIMEOUT_MS);
}
function write(api: ApiClient, path: string, body?: unknown): Promise<unknown> {
  return withTimeout(api.post<unknown>(path, body, { idempotencyKey: generateIdempotencyKey() }), WRITE_TIMEOUT_MS);
}
function patch(api: ApiClient, path: string, body?: unknown): Promise<unknown> {
  return withTimeout(api.patch<unknown>(path, body), WRITE_TIMEOUT_MS);
}

/** The Full Count home for this branch: the running cycle (if any), the catalogue size, the suggested batch size. */
export async function fetchCycleHome(api: ApiClient, branchId: string): Promise<CycleHome | null> {
  const id = branchId.trim();
  const query = id ? `?branchId=${encodeURIComponent(id)}` : '';
  return readHome(await read(api, `${BASE}/home${query}`));
}

/** Start a full count at a branch, in batches of `batchSize`. Returns the new cycle, or null on an unreadable answer. */
export async function startCycle(api: ApiClient, branchId: string, batchSize: number): Promise<CountCycle | null> {
  return readCycle(await write(api, BASE, { branchId, batchSize }));
}

/** Cancel a running cycle. Returns the cycle as it now stands, or null on an unreadable answer. */
export async function cancelCycle(api: ApiClient, cycleId: string): Promise<CountCycle | null> {
  return readCycle(await write(api, `${BASE}/${encodeURIComponent(cycleId)}/cancel`));
}

/** Open the next batch to count in a cycle. Returns the batch with its lines, or null on an unreadable answer. */
export async function openNextBatch(api: ApiClient, cycleId: string): Promise<Batch | null> {
  return readBatch(await write(api, `${BASE}/${encodeURIComponent(cycleId)}/batches`));
}

/** Read a batch and its lines by session id. */
export async function fetchBatch(api: ApiClient, sessionId: string): Promise<Batch | null> {
  return readBatch(await read(api, `${BASE}/batches/${encodeURIComponent(sessionId)}`));
}

/** Record a counted quantity for one line. Returns the batch as it now stands. */
export async function countLine(api: ApiClient, sessionId: string, lineId: string, countedQty: number): Promise<Batch | null> {
  return readBatch(
    await patch(api, `${BASE}/batches/${encodeURIComponent(sessionId)}/lines/${encodeURIComponent(lineId)}`, { countedQty })
  );
}

/** Finish counting a batch (close it so its counts can be reviewed and applied). Returns the cycle. */
export async function finishBatch(api: ApiClient, sessionId: string): Promise<CountCycle | null> {
  return readCycle(await write(api, `${BASE}/batches/${encodeURIComponent(sessionId)}/finish`));
}

/** Read a closed batch for review (same shape as a batch, read-only). */
export async function fetchReview(api: ApiClient, sessionId: string): Promise<Batch | null> {
  return readBatch(await read(api, `${BASE}/batches/${encodeURIComponent(sessionId)}/review`));
}

/** Apply the reviewed counts to stock. `lineIds` empty means every line in the batch. Returns the cycle. */
export async function applyBatch(api: ApiClient, sessionId: string, lineIds: string[]): Promise<CountCycle | null> {
  return readCycle(await write(api, `${BASE}/batches/${encodeURIComponent(sessionId)}/apply`, { lineIds }));
}
