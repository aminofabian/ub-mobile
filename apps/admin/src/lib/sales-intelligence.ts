import type { ApiClient } from '@kiosk/core';
import { signedCents } from './owner-money';

/** Today in the shop's local time as YYYY-MM-DD, for the `from`/`to` range the intelligence endpoints take. */
function isoToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function text(value: unknown, max = 120): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

function wholeCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function asArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    for (const key of ['rows', 'items', 'hours', 'content', 'data']) {
      const v = (raw as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

// ─── Recent sales feed ──────────────────────────────────────────────────────

/** One line of the live sales tape: what sold, for how much, by whom, when, and how it was paid. */
export type RecentSale = {
  id: string;
  soldAt: number | null;
  itemName: string;
  quantity: number | null;
  totalCents: number | null;
  cashierName: string | null;
  method: string | null;
};

function readRecentSale(raw: unknown, i: number): RecentSale | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const item = text(row.itemName, 80) ?? 'Item';
  const soldAtRaw = typeof row.soldAt === 'string' ? Date.parse(row.soldAt) : NaN;
  return {
    id: text(row.saleId, 64) ?? `sale-${i}`,
    soldAt: Number.isNaN(soldAtRaw) ? null : soldAtRaw,
    itemName: item,
    quantity: typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : null,
    totalCents: signedCents(row.lineTotal),
    cashierName: text(row.cashierName, 48),
    method: text(row.paymentMethods, 32) ?? text(row.paymentMethod, 32),
  };
}

/**
 * One row per sale, not per line.
 *
 * The tape answers one row per item sold, which is what a ticker wants and not what "Recent sales" means: a basket of
 * bread and milk is one sale of two items, and it should read that way. The newest time wins, the money adds up, and the
 * names are joined so the row still says what was in it.
 */
function foldBySale(rows: RecentSale[]): RecentSale[] {
  const bySale = new Map<string, RecentSale & { names: string[] }>();
  for (const row of rows) {
    const seen = bySale.get(row.id);
    if (!seen) {
      bySale.set(row.id, { ...row, names: [row.itemName] });
      continue;
    }
    bySale.set(row.id, {
      ...seen,
      soldAt: Math.max(seen.soldAt ?? 0, row.soldAt ?? 0) || null,
      quantity: (seen.quantity ?? 0) + (row.quantity ?? 0),
      totalCents: (seen.totalCents ?? 0) + (row.totalCents ?? 0),
      names: seen.names.includes(row.itemName) ? seen.names : [...seen.names, row.itemName],
    });
  }
  return [...bySale.values()].map(({ names, ...sale }) => ({ ...sale, itemName: names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '') }));
}

/** The newest sales today (`GET /api/v1/sales/intelligence/recent-sales/tape`), most recent first. */
export async function fetchRecentSales(api: ApiClient, limit = 8): Promise<RecentSale[] | null> {
  const day = isoToday();
  const raw = await api.get<unknown>(
    `/api/v1/sales/intelligence/recent-sales/tape?from=${day}&to=${day}&limit=${limit}`,
  );
  const rows = asArray(raw).map(readRecentSale).filter((r): r is RecentSale => r !== null);
  return foldBySale(rows);
}

// ─── Busy hours ─────────────────────────────────────────────────────────────

export type SalesHour = { hour: number; revenueCents: number | null; saleCount: number | null };

/** Today's revenue by hour (`GET /api/v1/sales/intelligence/sales-by-hour`). */
export async function fetchSalesByHour(api: ApiClient): Promise<SalesHour[] | null> {
  const day = isoToday();
  const raw = await api.get<unknown>(`/api/v1/sales/intelligence/sales-by-hour?from=${day}&to=${day}`);
  const rows = asArray(raw)
    .map((r): SalesHour | null => {
      if (!r || typeof r !== 'object') return null;
      const row = r as Record<string, unknown>;
      const hour = wholeCount(row.hour);
      if (hour === null) return null;
      return { hour, revenueCents: signedCents(row.revenue), saleCount: wholeCount(row.saleCount) };
    })
    .filter((r): r is SalesHour => r !== null)
    .sort((a, b) => a.hour - b.hour);
  return rows;
}

// ─── Revenue by category ────────────────────────────────────────────────────

export type CategoryRevenue = { name: string; revenueCents: number | null };

/** Today's revenue per category (`GET /api/v1/sales/intelligence/revenue-by-category`), biggest first. */
export async function fetchRevenueByCategory(api: ApiClient, top = 6): Promise<CategoryRevenue[] | null> {
  const day = isoToday();
  const raw = await api.get<unknown>(`/api/v1/sales/intelligence/revenue-by-category?from=${day}&to=${day}`);
  const rows = asArray(raw)
    .map((r): CategoryRevenue | null => {
      if (!r || typeof r !== 'object') return null;
      const row = r as Record<string, unknown>;
      const name = text(row.categoryName, 60);
      if (!name) return null;
      return { name, revenueCents: signedCents(row.netRevenue) };
    })
    .filter((r): r is CategoryRevenue => r !== null)
    .sort((a, b) => (b.revenueCents ?? 0) - (a.revenueCents ?? 0))
    .slice(0, top);
  return rows;
}

// ─── Staff performance ──────────────────────────────────────────────────────

export type StaffSales = { userId: string; name: string; saleCount: number | null; revenueCents: number | null };

/** Sales per staff member today (`GET /api/v1/sales/intelligence/staff-performance`), top sellers first. */
export async function fetchStaffPerformance(api: ApiClient): Promise<StaffSales[] | null> {
  const day = isoToday();
  const raw = await api.get<unknown>(`/api/v1/sales/intelligence/staff-performance?from=${day}&to=${day}`);
  const rows = asArray(raw)
    .map((r, i): StaffSales | null => {
      if (!r || typeof r !== 'object') return null;
      const row = r as Record<string, unknown>;
      const name = text(row.userName, 60);
      if (!name) return null;
      return {
        userId: text(row.userId, 64) ?? `staff-${i}`,
        name,
        saleCount: wholeCount(row.saleCount),
        revenueCents: signedCents(row.totalRevenue),
      };
    })
    .filter((r): r is StaffSales => r !== null)
    .sort((a, b) => (b.revenueCents ?? 0) - (a.revenueCents ?? 0));
  return rows;
}
