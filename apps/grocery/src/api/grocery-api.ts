import {
  parseStockSettings,
  READ_TIMEOUT_MS,
  WRITE_TIMEOUT_MS,
  withTimeout,
  type ApiClient,
  type StockSettings,
} from '@kiosk/core';
import {
  cancelDraftPath,
  DRAFTS_PATH,
  draftBody,
  draftPath,
  issueBody,
  issuePath,
  LEFT_OVER_REASON,
  openDraftsPath,
  type ForwardEntry,
} from '../lib/forward';
import { cancelPath, invoicePath, invoicesPath, readInvoices, readOneInvoice, type GroceryInvoice, type InvoiceState } from '../lib/invoices';

/**
 * Every call the Grocery counter makes to the server, each with a limit on how long the app waits. A sale is sent in two
 * steps, a draft and then the invoice, each under a key that was made and written down before anything was sent, so
 * asking again after a lost answer gets back what the server already made and never makes a second invoice.
 */

/** Which jobs the shop lets a grocery clerk do. The shop's own switches; anything unreadable leaves them on, as the web does. */
export async function fetchStockSettings(api: ApiClient): Promise<StockSettings> {
  return parseStockSettings(await withTimeout(api.get<unknown>('/api/v1/businesses/me'), READ_TIMEOUT_MS));
}

/** Step 1: makes the draft, or gets the one the server already has for this sale. Throws what the request throws. */
export function makeDraft(api: ApiClient, entry: ForwardEntry): Promise<unknown> {
  return withTimeout(api.post<unknown>(DRAFTS_PATH, draftBody(entry)), WRITE_TIMEOUT_MS);
}

/** Step 2: makes the invoice from the draft under the sale's own key, or gets the one it already made. */
export function issueDraft(api: ApiClient, entry: ForwardEntry): Promise<unknown> {
  if (!entry.draftId) return Promise.reject(new Error('The sale has no draft yet.'));
  return withTimeout(api.post<unknown>(issuePath(entry.draftId), issueBody(), { idempotencyKey: entry.issueKey }), WRITE_TIMEOUT_MS);
}

/** The drafts this person has open at the sale's branch. The server puts a new draft's lines into one that is open, so they are looked at first. */
export function listOpenDrafts(api: ApiClient, entry: ForwardEntry): Promise<unknown> {
  return withTimeout(api.get<unknown>(openDraftsPath(entry.branchId, entry.ownerId)), READ_TIMEOUT_MS);
}

/** One draft as the server has it now: the name it was made under says whose it is. */
export function readDraft(api: ApiClient, draftId: string): Promise<unknown> {
  return withTimeout(api.get<unknown>(draftPath(draftId)), READ_TIMEOUT_MS);
}

/** Cancels a draft that is still open. A draft that is already issued or cancelled answers "locked", which leaves it as it was. */
export function cancelDraft(api: ApiClient, draftId: string): Promise<unknown> {
  return withTimeout(api.post<unknown>(cancelDraftPath(draftId), { reason: LEFT_OVER_REASON }), WRITE_TIMEOUT_MS);
}

/** The branch's invoices, newest first as the screen sorts them. Null when the answer is not a list. Throws when the server cannot be reached. */
export async function fetchInvoices(api: ApiClient, branchId: string, state?: InvoiceState): Promise<GroceryInvoice[] | null> {
  return readInvoices(await withTimeout(api.get<unknown>(invoicesPath(branchId, state)), READ_TIMEOUT_MS));
}

/** One invoice as it is now. Null when the answer is not an invoice. Throws when the server cannot be reached. */
export async function fetchInvoice(api: ApiClient, id: string): Promise<GroceryInvoice | null> {
  return readOneInvoice(await withTimeout(api.get<unknown>(invoicePath(id)), READ_TIMEOUT_MS));
}

/** Cancels an invoice that is waiting for payment. Sent once: a lost answer is settled by reading the invoice. */
export async function cancelInvoice(api: ApiClient, id: string, body: { reason: string }): Promise<void> {
  await withTimeout(api.post<unknown>(cancelPath(id), body), WRITE_TIMEOUT_MS);
}
