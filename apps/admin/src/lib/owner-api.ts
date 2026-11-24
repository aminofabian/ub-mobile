import {
  itemsPath,
  READ_TIMEOUT_MS,
  readItemsPage,
  WRITE_TIMEOUT_MS,
  withTimeout,
  type ApiClient,
  type ItemsPage,
} from '@kiosk/core';
import {
  customerPath,
  readBalance,
  readCreditSummary,
  readPaymentAnswer,
  readTabs,
  tabsPath,
  type CreditSummary,
  type CreditTab,
  type PaymentBody,
} from './credit';
import { readOrders, type OwnerOrder, type StepTarget } from './orders';
import { readPulse, type Pulse } from './pulse';
import { readStaff, STAFF_LIST_SIZE, type StaffPerson } from './staff';

/**
 * Every call the Owner screens make to the server, each with a limit on how long the app waits for the answer. A read
 * throws when the server cannot be reached and returns null when its answer is not what was asked for: a failed read is
 * never passed on as "nothing there". A change is sent once; what a lost answer means is decided by the screen that
 * sent it, after it has looked at where things stand now.
 */

const WEB_ORDERS = '/api/v1/web-orders';
const USERS = '/api/v1/users';

function read(api: ApiClient, path: string): Promise<unknown> {
  return withTimeout(api.get<unknown>(path), READ_TIMEOUT_MS);
}

/** The finance pulse of a day (`YYYY-MM-DD`), or of today in the shop's own time zone when no day is given. All branches. */
export async function fetchPulse(api: ApiClient, date?: string): Promise<Pulse | null> {
  const path = date ? `/api/v1/finance/pulse?date=${encodeURIComponent(date)}` : '/api/v1/finance/pulse';
  return readPulse(await read(api, path));
}

/** What the shop's customers owe, and what was paid in on tabs today. */
export async function fetchCreditSummary(api: ApiClient): Promise<CreditSummary | null> {
  return readCreditSummary(await read(api, '/api/v1/credits/activity-summary'));
}

/** The open tabs, narrowed by a search when one is typed. */
export async function fetchTabs(api: ApiClient, query: string): Promise<{ tabs: CreditTab[]; omitted: number } | null> {
  return readTabs(await read(api, tabsPath(query)));
}

/** What one customer owes now. Null when the answer has no balance in it. */
export async function fetchBalance(api: ApiClient, customerId: string): Promise<number | null> {
  return readBalance(await read(api, customerPath(customerId)));
}

/**
 * Records a payment against a tab. The server applies it at once and does not recognise a repeat, so this is sent once
 * and never again by the app on its own. Throws when the server refuses it or when no answer comes back.
 */
export async function postTabPayment(api: ApiClient, body: PaymentBody): Promise<{ claimId: string | null; balanceCents: number | null }> {
  return readPaymentAnswer(await withTimeout(api.post<unknown>('/api/v1/credits/tab-payments', body), WRITE_TIMEOUT_MS));
}

/** The newest fifty web orders. Needs the storefront permission. */
export async function fetchOrders(api: ApiClient): Promise<OwnerOrder[] | null> {
  return readOrders(await read(api, `${WEB_ORDERS}?size=50`));
}

/**
 * Moves a paid web order one step along. The server allows one step at a time and answers 409 to one already taken,
 * which is what keeps a second tap, or a second phone, from doing it twice.
 */
export async function advanceOrder(api: ApiClient, orderId: string, to: StepTarget): Promise<void> {
  await withTimeout(api.patch<unknown>(`${WEB_ORDERS}/${encodeURIComponent(orderId)}/fulfillment`, { fulfillmentStatus: to }), WRITE_TIMEOUT_MS);
}

async function countOf(api: ApiClient, branchId: string, flag: { lowStock: true } | { zeroStock: true }): Promise<number | null> {
  const page = readItemsPage(await read(api, itemsPath({ branchId, ...flag, size: 1 })), { page: 0, size: 1 });
  return page?.total ?? null;
}

/** How many items are running low and how many are out at a branch. Null when either count was not in the answer. */
export async function fetchStockCounts(api: ApiClient, branchId: string): Promise<{ low: number; out: number } | null> {
  const [low, out] = await Promise.all([countOf(api, branchId, { lowStock: true }), countOf(api, branchId, { zeroStock: true })]);
  return low === null || out === null ? null : { low, out };
}

/** The most items one list on the Stock screen holds, which is the most the server's list gives at once. A shop with more sees the rest on the web. */
export const STOCK_LIST_SIZE = 100;

/** The items that are out, or running low, at a branch. */
export async function fetchStockList(api: ApiClient, branchId: string, which: 'out' | 'low'): Promise<ItemsPage | null> {
  const flag = which === 'low' ? ({ lowStock: true } as const) : ({ zeroStock: true } as const);
  const asked = { page: 0, size: STOCK_LIST_SIZE };
  return readItemsPage(await read(api, itemsPath({ branchId, ...flag, ...asked })), asked);
}

/**
 * The people who work at the shop: the active ones, as many as the Staff screen shows. A person who has been
 * deactivated, or invited and not yet joined, is not working there. Needs the permission to list users.
 */
export async function fetchStaff(api: ApiClient): Promise<StaffPerson[] | null> {
  return readStaff(await read(api, `${USERS}?status=active&size=${STAFF_LIST_SIZE}`));
}
