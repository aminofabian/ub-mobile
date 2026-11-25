import { generateIdempotencyKey, type ApiClient } from '@kiosk/core';
import type { CartLine } from '../lib/cart';

/**
 * Parked sales ("drafts"). A cashier serving several customers at once can park the basket in front
 * of them to the server and start a fresh one; any till on the branch can then pick that parked sale
 * back up — so a sale survives a cashier swapping out mid-shift, or the phone being set down. This
 * is the server-backed version of a hold, shared across the branch. Endpoints:
 * `POST pos-drafts` (park), `GET pos-drafts` (list), `GET pos-drafts/{id}` (open),
 * `POST pos-drafts/{id}/cancel` (clear). Reading needs `pos.drafts.read`, parking `pos.drafts.write`.
 */

/** One parked sale in the list, enough to show it and decide whether to resume it. */
export interface DraftSummary {
  id: string;
  ticketNumber: number;
  lineCount: number;
  grandTotal: number;
  createdByName: string | null;
  createdAt: string;
  /** This phone's local id for the draft it parked, so a till knows which card is its own. */
  clientDraftId: string | null;
}

/** A parked sale opened in full, ready to become the live basket again. */
export interface DraftDetail {
  id: string;
  ticketNumber: number;
  lines: CartLine[];
  grandTotal: number;
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function toStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function toStrOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Park the current basket as a draft on the server. Returns the server id and ticket number. */
export async function parkDraft(
  api: ApiClient,
  branchId: string,
  cart: readonly CartLine[]
): Promise<{ id: string; ticketNumber: number }> {
  const clientDraftId = generateIdempotencyKey();
  const lines = cart
    // A service line's id is made up and is no product's, so the server draft (which keys on real
    // items) cannot hold it; those stay out of a parked sale.
    .filter((l) => !l.service)
    .map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitPrice: l.unitPrice }));
  const res = (await api.post<Record<string, unknown>>(
    '/api/v1/pos-drafts',
    { branchId, clientDraftId, lines },
    { idempotencyKey: clientDraftId }
  )) as Record<string, unknown>;
  return { id: toStr(res?.id), ticketNumber: toNum(res?.ticketNumber) };
}

/** The parked sales waiting on this branch, newest first. */
export async function listDrafts(api: ApiClient, branchId: string): Promise<DraftSummary[]> {
  const raw = (await api.get<unknown>(
    `/api/v1/pos-drafts?branchId=${encodeURIComponent(branchId)}&status=pending`
  )) as Record<string, unknown>;
  const list = Array.isArray(raw?.drafts) ? raw.drafts : [];
  return list
    .map((row): DraftSummary | null => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const id = toStrOrNull(o.id);
      if (!id) return null;
      return {
        id,
        ticketNumber: toNum(o.ticketNumber),
        lineCount: toNum(o.lineCount),
        grandTotal: toNum(o.grandTotal),
        createdByName: toStrOrNull(o.createdByName),
        createdAt: toStr(o.createdAt),
        clientDraftId: toStrOrNull(o.clientDraftId),
      };
    })
    .filter((d): d is DraftSummary => d !== null);
}

/** Open a parked sale in full — its lines, as cart lines ready to load. */
export async function openDraft(api: ApiClient, draftId: string): Promise<DraftDetail> {
  const raw = (await api.get<unknown>(`/api/v1/pos-drafts/${encodeURIComponent(draftId)}`)) as Record<string, unknown>;
  const linesRaw = Array.isArray(raw?.lines) ? raw.lines : [];
  const lines: CartLine[] = linesRaw
    .map((l): CartLine | null => {
      if (!l || typeof l !== 'object') return null;
      const o = l as Record<string, unknown>;
      const itemId = toStrOrNull(o.itemId);
      if (!itemId) return null;
      return {
        itemId,
        name: toStr(o.itemName) || 'Item',
        quantity: toNum(o.quantity),
        unitPrice: toNum(o.unitPrice),
      };
    })
    .filter((l): l is CartLine => l !== null);
  return {
    id: toStr(raw?.id),
    ticketNumber: toNum(raw?.ticketNumber),
    lines,
    grandTotal: toNum(raw?.grandTotal),
  };
}

/** Clear a parked sale on the server (it was resumed into a basket, or thrown away). */
export async function cancelDraft(api: ApiClient, draftId: string, reason?: string): Promise<void> {
  await api.post(`/api/v1/pos-drafts/${encodeURIComponent(draftId)}/cancel`, {
    reason: reason ?? null,
    clearAll: null,
  });
}
