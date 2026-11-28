import {
  generateIdempotencyKey,
  isApiError,
  itemsPath,
  READ_TIMEOUT_MS,
  readItemsPage,
  searchTerms,
  unitsToQty,
  WRITE_TIMEOUT_MS,
  withTimeout,
  type ApiClient,
  type SpoilReason,
  type StockItem,
} from '@kiosk/core';
import { readActive, readTake, type ActiveTake, type StockTake } from '../lib/stock-take';
import { readCreated, readTransfers, stepPath, type Transfer, type TransferAction } from '../lib/transfers';
import {
  clearBody,
  clearPath,
  readSupplyBatches,
  readSupplyDetail,
  supplyDetailPath,
  supplyListPath,
  type SupplyBatch,
  type SupplyDetail,
  type SupplyStatus,
} from '../lib/supply-batches';

/**
 * Every call the Stock app makes to the server, each with a limit on how long the app waits for the answer. Reads
 * throw when the server cannot be reached and return null when its answer is not what was asked for: a failed read is
 * never passed on as "nothing there". Changes are sent once; what a lost answer means is decided by the screen that
 * sent it, after it has looked at where things stand now.
 */

const TAKE = '/api/v1/inventory/stock-take/sessions';

function read(api: ApiClient, path: string): Promise<unknown> {
  return withTimeout(api.get<unknown>(path), READ_TIMEOUT_MS);
}

function write(api: ApiClient, path: string, body?: unknown, options?: { idempotencyKey: string }): Promise<unknown> {
  return withTimeout(api.post<unknown>(path, body, options), WRITE_TIMEOUT_MS);
}

/** How many items are running low, and how many are out, at a branch. A count that could not be read is null. */
export async function fetchItemCounts(api: ApiClient, branchId: string): Promise<{ low: number | null; out: number | null }> {
  const count = async (flag: { lowStock: true } | { zeroStock: true }): Promise<number | null> => {
    try {
      const raw = await read(api, itemsPath({ branchId, ...flag, size: 1 }));
      return readItemsPage(raw, { page: 0, size: 1 })?.total ?? null;
    } catch {
      return null;
    }
  };
  const [low, out] = await Promise.all([count({ lowStock: true }), count({ zeroStock: true })]);
  return { low, out };
}

/** The items a scanned or typed code finds at this branch. Null when the answer is not a list of items. Throws when the server cannot be reached. */
export async function findByCode(api: ApiClient, branchId: string, code: string): Promise<StockItem[] | null> {
  const terms = searchTerms(code);
  if (!terms) return [];
  return readItemsPage(await read(api, itemsPath({ branchId, ...terms, size: 5 })), { page: 0, size: 5 })?.items ?? null;
}

// ---------------------------------------------------------------------------------------------
// Stock take
// ---------------------------------------------------------------------------------------------

/** The open stock take at a branch for a day, or the one left open from an earlier day. Null when the answer is not either. */
export async function fetchActiveTake(api: ApiClient, branchId: string, date: string): Promise<ActiveTake | null> {
  return readActive(await read(api, `${TAKE}/active?branchId=${encodeURIComponent(branchId)}&date=${encodeURIComponent(date)}`));
}

export async function fetchTake(api: ApiClient, id: string): Promise<StockTake | null> {
  return readTake(await read(api, `${TAKE}/${encodeURIComponent(id)}`));
}

/**
 * Starts a stock take. The server does not refuse a second one for the same branch, day and kind (the rule that did was
 * dropped in V78), so a start that got no answer is never repeated blindly: the screen looks at what is open first. A 409,
 * from a server that does keep the rule, is read as "one is already open".
 */
export async function startTake(api: ApiClient, input: { branchId: string; kind: 'morning' | 'evening'; date: string }): Promise<StockTake | null> {
  return readTake(await write(api, TAKE, { branchId: input.branchId, sessionType: input.kind, sessionDate: input.date }));
}

/** "This line holds N": the same whether it is sent once or twice. */
export async function sendCount(api: ApiClient, sessionId: string, lineId: string, units: number): Promise<void> {
  await withTimeout(api.patch<unknown>(`${TAKE}/${encodeURIComponent(sessionId)}/lines/${encodeURIComponent(lineId)}`, { countedQty: unitsToQty(units) }), WRITE_TIMEOUT_MS);
}

/** Closes a stock take, with no override: the server refuses while counted lines have not been confirmed by a manager. */
export async function closeTake(api: ApiClient, id: string): Promise<StockTake | null> {
  return readTake(await write(api, `${TAKE}/${encodeURIComponent(id)}/close`));
}

/** Whether a failed start was the server saying one is already open. */
export function isAlreadyOpen(error: unknown): boolean {
  return isApiError(error) && error.status === 409;
}

// ---------------------------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------------------------

/** The transfers this branch is part of, either end. Null when the answer is not a list. */
export async function fetchTransfers(api: ApiClient, branchId: string): Promise<Transfer[] | null> {
  return readTransfers(await read(api, `/api/v1/inventory/transfers?branchId=${encodeURIComponent(branchId)}`));
}

/** Makes a draft transfer. The key makes asking again for the same wish safe on a server that reads it. */
export async function createTransfer(api: ApiClient, body: unknown, idempotencyKey: string = generateIdempotencyKey()): Promise<{ id: string } | null> {
  return readCreated(await write(api, '/api/v1/inventory/transfers', body, { idempotencyKey }));
}

/** One step of a transfer: send, receive or cancel. */
export async function stepTransfer(api: ApiClient, action: TransferAction, transferId: string): Promise<void> {
  await write(api, stepPath(action, transferId));
}

/** The shop's branches, id and name, as the sign-in screen lists them. Anything that is not a list is null. */
export async function fetchBranchList(api: ApiClient): Promise<Array<{ id?: unknown; name?: unknown }> | null> {
  const raw = await read(api, '/api/v1/auth/branches');
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? (raw as { branches?: unknown }).branches : null;
  if (!Array.isArray(list)) return null;
  return list.filter((row): row is { id?: unknown; name?: unknown } => !!row && typeof row === 'object');
}

// ---------------------------------------------------------------------------------------------
// Supply batches
// ---------------------------------------------------------------------------------------------

export async function fetchSupplyBatches(api: ApiClient, branchId: string, status?: SupplyStatus): Promise<SupplyBatch[] | null> {
  return readSupplyBatches(await read(api, supplyListPath({ branchId, ...(status ? { status } : {}) })));
}

export async function fetchSupplyDetail(api: ApiClient, id: string): Promise<SupplyDetail | null> {
  return readSupplyDetail(await read(api, supplyDetailPath(id)));
}

/** Writes off what is left of a batch, in one step on the server. */
export async function clearSupplyBatch(api: ApiClient, id: string, reason: SpoilReason, note?: string): Promise<void> {
  await write(api, clearPath(id), clearBody(reason, note));
}
