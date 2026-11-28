import { signedCents } from './owner-money';

/** One payment method's share of a day: how many sales it took and how much, both as the server reports them. */
export type MethodRow = {
  /** The method key the server uses, e.g. "MPESA", "CASH", "CARD". */
  method: string;
  /** How many transactions. Null when the server did not send a usable count. */
  count: number | null;
  /** How much, in whole cents. Null when not a plain amount. */
  amountCents: number | null;
};

/** The two the owner wants first, pulled out of the full breakdown; everything else is summed into "other". */
export type Breakdown = {
  mpesa: MethodRow;
  cash: MethodRow;
  /** Card, points, bank — whatever else the day had, rolled up. Null when there was nothing else. */
  other: MethodRow | null;
};

function wholeCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/** One row of `GET /api/v1/sales/intelligence/payments-by-method`. Anything without a method name is dropped. */
function readMethodRow(raw: unknown): MethodRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const method = typeof row.method === 'string' ? row.method.trim() : '';
  if (!method) return null;
  return { method, count: wholeCount(row.transactionCount), amountCents: signedCents(row.totalAmount) };
}

function isMpesa(method: string): boolean {
  return /mpesa|m-?pesa|stk/i.test(method);
}

function isCash(method: string): boolean {
  return /\bcash\b/i.test(method);
}

function mergeRows(rows: MethodRow[], label: string): MethodRow {
  const count = rows.reduce<number | null>((a, r) => (r.count === null ? a : (a ?? 0) + r.count), null);
  const amountCents = rows.reduce<number | null>((a, r) => (r.amountCents === null ? a : (a ?? 0) + r.amountCents), null);
  return { method: label, count, amountCents };
}

/**
 * Reads the payments-by-method array into the shape the Today hero wants: M-Pesa, cash, and everything
 * else summed. A day with no sales of a kind shows that kind as zero, not as missing, so the two lines
 * are always there once the figure is known.
 */
export function readBreakdown(raw: unknown): Breakdown | null {
  if (!Array.isArray(raw)) return null;
  const rows = raw.map(readMethodRow).filter((r): r is MethodRow => r !== null);
  const mpesaRows = rows.filter((r) => isMpesa(r.method));
  const cashRows = rows.filter((r) => isCash(r.method));
  const otherRows = rows.filter((r) => !isMpesa(r.method) && !isCash(r.method));
  return {
    mpesa: mpesaRows.length ? mergeRows(mpesaRows, 'M-Pesa') : { method: 'M-Pesa', count: 0, amountCents: 0 },
    cash: cashRows.length ? mergeRows(cashRows, 'Cash') : { method: 'Cash', count: 0, amountCents: 0 },
    other: otherRows.length ? mergeRows(otherRows, 'Other') : null,
  };
}
