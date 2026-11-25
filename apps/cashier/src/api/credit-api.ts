import type { ApiClient } from '@kiosk/core';

/**
 * Customer credit tabs, for the till's credit-tabs screen. A cashier may see who owes the shop and
 * how much, open a customer to read what they bought on credit, and propose a repayment — which goes
 * to an admin for approval (the cashier never clears a debt directly). Matches the web till's
 * credit-tabs flow: `GET customers/outstanding-tabs`, `GET customers/{id}/tab-purchases`,
 * `POST credits/tab-clearances`.
 */

/** One customer who owes the shop money on a tab. */
export interface OutstandingTab {
  customerId: string;
  name: string;
  primaryPhone: string | null;
  /** Shillings still owed. */
  balanceOwed: number;
  /** The shop has stopped this customer's credit. */
  creditSuspended: boolean;
}

/** One line of a past credit purchase. */
export interface TabPurchaseLine {
  itemName: string;
  quantity: number;
  /** Line total in shillings. */
  lineTotal: number | null;
}

/** One past credit sale on a customer's tab. */
export interface TabPurchase {
  saleId: string;
  receiptNo: number | null;
  soldAt: string;
  status: string;
  /** How much of this sale went on the tab. */
  creditAmount: number;
  grandTotal: number;
  lines: TabPurchaseLine[];
}

export interface TabPurchasesPage {
  rows: TabPurchase[];
  offset: number;
  limit: number;
  hasMore: boolean;
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = toNum(v);
  return Number.isFinite(n) ? n : null;
}
function toStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function toStrOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** The customers who owe the shop, most-owed first. `q` filters by name or phone. */
export async function fetchOutstandingTabs(api: ApiClient, q?: string): Promise<OutstandingTab[]> {
  const query = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  const raw = await api.get<unknown>(`/api/v1/customers/outstanding-tabs${query}`);
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((row): OutstandingTab | null => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const customerId = toStrOrNull(o.customerId);
      if (!customerId) return null;
      return {
        customerId,
        name: toStr(o.name) || 'Customer',
        primaryPhone: toStrOrNull(o.primaryPhone),
        balanceOwed: toNum(o.balanceOwed),
        creditSuspended: o.creditSuspended === true,
      };
    })
    .filter((t): t is OutstandingTab => t !== null);
}

/** What a customer bought on credit, newest first. */
export async function fetchCustomerTabPurchases(
  api: ApiClient,
  customerId: string,
  opts?: { offset?: number; limit?: number }
): Promise<TabPurchasesPage> {
  const params: string[] = [];
  if (opts?.offset != null) params.push(`offset=${opts.offset}`);
  if (opts?.limit != null) params.push(`limit=${opts.limit}`);
  const query = params.length ? `?${params.join('&')}` : '';
  const raw = await api.get<unknown>(
    `/api/v1/customers/${encodeURIComponent(customerId)}/tab-purchases${query}`
  );
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(o.rows) ? o.rows : [];
  const rows = rowsRaw
    .map((row): TabPurchase | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const saleId = toStrOrNull(r.saleId);
      if (!saleId) return null;
      const linesRaw = Array.isArray(r.lines) ? r.lines : [];
      return {
        saleId,
        receiptNo: toNumOrNull(r.receiptNo),
        soldAt: toStr(r.soldAt),
        status: toStr(r.status),
        creditAmount: toNum(r.creditAmount),
        grandTotal: toNum(r.grandTotal),
        lines: linesRaw
          .map((l): TabPurchaseLine | null => {
            if (!l || typeof l !== 'object') return null;
            const line = l as Record<string, unknown>;
            return {
              itemName: toStr(line.itemName) || 'Item',
              quantity: toNum(line.quantity),
              lineTotal: toNumOrNull(line.lineTotal),
            };
          })
          .filter((l): l is TabPurchaseLine => l !== null),
      };
    })
    .filter((r): r is TabPurchase => r !== null);
  return {
    rows,
    offset: toNum(o.offset),
    limit: toNum(o.limit) || rows.length,
    hasMore: o.hasMore === true,
  };
}

/**
 * Propose that a customer paid down their tab. This does not clear the debt itself — it is sent to an
 * admin for approval (the cashier has `credits.customers.read`, not the review right). Returns the
 * id of the claim that was raised.
 */
export async function proposeTabClearance(
  api: ApiClient,
  body: { customerId: string; amount: number; channel: 'cash' | 'mpesa'; reference?: string | null }
): Promise<{ claimId: string }> {
  const res = await api.post<{ claimId?: string }>('/api/v1/credits/tab-clearances', {
    customerId: body.customerId,
    amount: body.amount,
    channel: body.channel,
    reference: body.reference?.trim() || null,
  });
  return { claimId: toStr(res?.claimId) };
}
