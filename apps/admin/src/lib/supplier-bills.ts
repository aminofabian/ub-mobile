import { signedCents } from './owner-money';

/** What the shop still owes suppliers: how many pending invoices, and their total. */
export type SupplierBills = {
  /** How many invoices are still to be paid. */
  count: number;
  /** Their total, in whole cents. Null when no invoice carried a usable figure. */
  totalCents: number | null;
};

/**
 * Reads `GET /api/v1/grocery/invoices?status=PENDING` into a count and total. The server sends either the
 * array or a `{ invoices }` wrapper (the cashier reads it the same way). Rows without a figure still count,
 * but add nothing to the total.
 */
export function readSupplierBills(raw: unknown): SupplierBills | null {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { invoices?: unknown }).invoices)
      ? (raw as { invoices: unknown[] }).invoices
      : null;
  if (list === null) return null;
  let count = 0;
  let totalCents: number | null = null;
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    count += 1;
    const amount = signedCents((row as { grandTotal?: unknown }).grandTotal);
    if (amount !== null) totalCents = (totalCents ?? 0) + amount;
  }
  return { count, totalCents };
}
