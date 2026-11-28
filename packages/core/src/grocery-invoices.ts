import { cleanDisplayText } from './display-text';
import { isApiError } from './problem';
import { priceToCents } from './stock-items';
import { GROCERY_INVOICES_CANCEL } from './stock-access';
import type { AccessUser } from './stock-access';

/**
 * The invoices a grocery clerk has sent to the till, as the server lists them. A clerk sees only their own; a manager
 * sees the branch's. Only an invoice still waiting for payment can be cancelled, and the server wants a reason.
 */

export type InvoiceState = 'pending_payment' | 'paid' | 'cancelled' | 'expired' | 'other';

export type GroceryInvoice = {
  id: string;
  /** The code on the invoice, which the cashier scans or types. */
  code: string | null;
  state: InvoiceState;
  totalCents: number | null;
  lineCount: number;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: number | null;
  expiresAt: number | null;
  /** The cashier who has it open at the till right now. */
  lockedByName: string | null;
  remote: boolean;
  customerPhone: string | null;
};

const STATES: readonly InvoiceState[] = ['pending_payment', 'paid', 'cancelled', 'expired'];

function stateOf(value: unknown): InvoiceState {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return STATES.find((state) => state === text) ?? 'other';
}

/** A moment as the server writes it: an ISO date, or seconds or milliseconds since 1970. Milliseconds since 1970, or null. */
export function readInstant(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value < 100_000_000_000 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value !== 'string' || value === '') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function maybeText(value: unknown, max: number): string | null {
  return cleanDisplayText(value, max) || null;
}

function readInvoice(raw: unknown): GroceryInvoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id === '') return null;
  const lineCount = typeof row.lineCount === 'number' && Number.isInteger(row.lineCount) && row.lineCount >= 0 ? row.lineCount : Array.isArray(row.lines) ? row.lines.length : 0;
  return {
    id: row.id,
    code: maybeText(row.barcodeCode, 40),
    state: stateOf(row.status),
    totalCents: priceToCents(row.grandTotal),
    lineCount,
    createdBy: typeof row.createdBy === 'string' && row.createdBy !== '' ? row.createdBy : null,
    createdByName: maybeText(row.createdByName, 80),
    createdAt: readInstant(row.createdAt),
    expiresAt: readInstant(row.expiresAt),
    lockedByName: maybeText(row.lockedByName, 80),
    remote: row.remote === true,
    customerPhone: maybeText(row.customerPhone, 24),
  };
}

/** The server's list (`{invoices: [...]}`). Null when it is not a list, so a wrong answer is never shown as "no invoices". */
export function readInvoices(raw: unknown): GroceryInvoice[] | null {
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { invoices?: unknown }).invoices) ? (raw as { invoices: unknown[] }).invoices : null;
  if (!rows) return null;
  const invoices: GroceryInvoice[] = [];
  for (const row of rows) {
    const invoice = readInvoice(row);
    if (invoice) invoices.push(invoice);
  }
  return invoices;
}

/** One invoice, as `GET /grocery/invoices/{id}` answers. */
export function readOneInvoice(raw: unknown): GroceryInvoice | null {
  return readInvoice(raw);
}

export const INVOICES_PATH = '/api/v1/grocery/invoices';

export function invoicesPath(branchId: string, state?: InvoiceState): string {
  const status = state && state !== 'other' ? `&status=${state}` : '';
  return `${INVOICES_PATH}?branchId=${encodeURIComponent(branchId)}${status}`;
}

export function invoicePath(id: string): string {
  return `${INVOICES_PATH}/${encodeURIComponent(id)}`;
}

export function cancelPath(id: string): string {
  return `${invoicePath(id)}/cancel`;
}

export const stateWords: Record<InvoiceState, string> = {
  pending_payment: 'Waiting for payment',
  paid: 'Paid',
  cancelled: 'Cancelled',
  expired: 'Expired',
  other: 'Unknown',
};

/** Newest first. Invoices with no time go last. */
export function sortInvoices(invoices: readonly GroceryInvoice[]): GroceryInvoice[] {
  return [...invoices].sort((a, b) => (b.createdAt ?? -1) - (a.createdAt ?? -1));
}

/** "Expires in 12 min", "Expires in 2 h", "Expired", or null when the server gave no time or the invoice is closed. */
export function expiryWords(invoice: GroceryInvoice, now: number): string | null {
  if (invoice.state !== 'pending_payment' || invoice.expiresAt === null) return null;
  const minutes = Math.ceil((invoice.expiresAt - now) / 60_000);
  if (minutes <= 0) return 'Expired';
  if (minutes < 60) return `Expires in ${minutes} min`;
  return `Expires in ${Math.ceil(minutes / 60)} h`;
}

// ---------------------------------------------------------------------------------------------
// Cancelling
// ---------------------------------------------------------------------------------------------

export const CANCEL_REASONS = [
  { key: 'changed_mind', words: 'Customer changed their mind' },
  { key: 'wrong_items', words: 'Wrong items on it' },
  { key: 'sent_twice', words: 'Sent twice by mistake' },
  { key: 'price', words: 'Price problem' },
  { key: 'other', words: 'Other' },
] as const;

export type CancelReasonKey = (typeof CANCEL_REASONS)[number]['key'];

export const MAX_CANCEL_REASON = 200;

/** A cancellation is for an invoice still waiting for payment, by someone who may cancel. The server has the last word. */
export function canCancel(invoice: GroceryInvoice, user: AccessUser): boolean {
  return invoice.state === 'pending_payment' && user.permissions.includes(GROCERY_INVOICES_CANCEL);
}

/** The reason as the server wants it. A preset is its words; "Other" is what was typed. Null when there is nothing to send. */
export function cancelBody(reason: CancelReasonKey, typed: string): { reason: string } | null {
  const preset = CANCEL_REASONS.find((candidate) => candidate.key === reason);
  if (!preset) return null;
  const text = reason === 'other' ? cleanDisplayText(typed, MAX_CANCEL_REASON) : preset.words;
  return text ? { reason: text } : null;
}

export type CancelFailure = 'doubt' | 'moved_on' | 'gone' | 'not_allowed' | 'refused';

/**
 * What a failed cancel means. No answer, a session that ended or a busy server: nobody knows whether it went through, so
 * the invoice is read again. A 409 is "it is not waiting for payment any more", a 404 is "no such invoice for you" (the
 * server answers a clerk that way for another clerk's invoice). The status is read, never the words.
 */
export function classifyCancel(error: unknown): CancelFailure {
  if (!isApiError(error) || error.foreign) return 'doubt';
  const { status } = error;
  if (status === 401 || status === 408 || status === 423 || status === 429 || status >= 500) return 'doubt';
  if (status === 409) return 'moved_on';
  if (status === 404) return 'gone';
  if (status === 403) return 'not_allowed';
  return status >= 400 ? 'refused' : 'doubt';
}

export const cancelFailureWords: Record<Exclude<CancelFailure, 'doubt'>, string> = {
  moved_on: 'This invoice is no longer waiting for payment. It may have been paid or have expired.',
  gone: 'This invoice could not be found on your account.',
  not_allowed: 'You are not allowed to cancel invoices.',
  refused: 'The server did not accept the cancellation.',
};

export type CancelOutcome = 'cancelled' | 'open' | 'closed' | 'unknown';

/** After a cancel whose answer was lost: what the invoice is now. `open` means it is still waiting and can be cancelled again. */
export function cancelOutcome(raw: unknown): CancelOutcome {
  return cancelOutcomeOf(readOneInvoice(raw));
}

/** The same, for an invoice that has already been read. */
export function cancelOutcomeOf(invoice: GroceryInvoice | null): CancelOutcome {
  if (!invoice) return 'unknown';
  if (invoice.state === 'cancelled') return 'cancelled';
  if (invoice.state === 'pending_payment') return 'open';
  return invoice.state === 'other' ? 'unknown' : 'closed';
}
