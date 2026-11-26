import { MAX_BASKET_LINES, type Basket } from './basket';

/**
 * Parked baskets: several sales on the counter at once, the way the web counter keeps drafts.
 *
 * A draft is a whole basket — the same lines, the same rounding — kept beside the active one. The active basket is still
 * the single `groceryBasket`; drafts live in their own slot, so nothing about the working sale changes when one is
 * parked or picked up. Names are what the clerk typed; the line count and time stand in when they left it blank.
 */

export type Draft = { id: string; name: string; basket: Basket; savedAt: number };
export type DraftState = { ownerId: string; items: Draft[] };

export const MAX_DRAFTS = 8;
/** The same day a basket lives for: a draft nobody came back for is not worth keeping. */
export const DRAFT_LIFETIME_MS = 24 * 60 * 60_000;
const MAX_NAME = 40;

export const NO_DRAFTS: DraftState = { ownerId: '', items: [] };

/** Drafts parked in the same millisecond still need different ids — parking twice quickly is normal at a queue. */
let lastIdAt = 0;
let lastIdSeq = 0;
function nextDraftId(now: number): string {
  if (now === lastIdAt) lastIdSeq += 1;
  else {
    lastIdAt = now;
    lastIdSeq = 0;
  }
  return `${now}-${lastIdSeq}`;
}

/** A name for a draft: what the clerk said, or what is in it. */
export function draftName(text: string, basket: Basket): string {
  const trimmed = text.trim().slice(0, MAX_NAME);
  if (trimmed) return trimmed;
  const first = basket.lines[0]?.name;
  const more = basket.lines.length - 1;
  if (!first) return 'Empty basket';
  return more > 0 ? `${first} + ${more}` : first;
}

/** Drafts that belong to this person and have not aged out. */
export function draftsFor(state: DraftState | null, ownerId: string, now: number): Draft[] {
  if (!state || state.ownerId !== ownerId) return [];
  return state.items.filter((draft) => now - draft.savedAt <= DRAFT_LIFETIME_MS);
}

export type ParkResult =
  | { ok: true; state: DraftState }
  | { ok: false; why: 'empty' | 'full' | 'not_yours' };

/** Parks a basket: it leaves the counter and waits in the list. */
export function parkDraft(
  state: DraftState | null,
  basket: Basket,
  name: string,
  now: number
): ParkResult {
  if (basket.lines.length === 0) return { ok: false, why: 'empty' };
  const owner = state && state.ownerId === basket.ownerId ? state : { ownerId: basket.ownerId, items: [] };
  if (draftsFor(owner, basket.ownerId, now).length >= MAX_DRAFTS) return { ok: false, why: 'full' };
  const draft: Draft = { id: nextDraftId(now), name: draftName(name, basket), basket: { ...basket, savedAt: now }, savedAt: now };
  return { ok: true, state: { ownerId: basket.ownerId, items: [draft, ...owner.items] } };
}

export type ResumeResult = { draft: Draft; state: DraftState };

/** Takes a draft back onto the counter: it leaves the list and becomes the active basket. */
export function resumeDraft(state: DraftState | null, id: string, ownerId: string, now: number): ResumeResult | null {
  const items = draftsFor(state, ownerId, now);
  const draft = items.find((candidate) => candidate.id === id);
  if (!draft) return null;
  return {
    draft,
    state: { ownerId, items: (state?.items ?? []).filter((candidate) => candidate.id !== id) },
  };
}

export function dropDraft(state: DraftState | null, id: string): DraftState | null {
  if (!state) return state;
  return { ownerId: state.ownerId, items: state.items.filter((draft) => draft.id !== id) };
}

// ---------------------------------------------------------------------------------------------
// Kept on the phone
// ---------------------------------------------------------------------------------------------

export function encodeDrafts(state: DraftState | null): string | null {
  if (!state || state.items.length === 0) return null;
  return JSON.stringify({ v: 1, ...state });
}

/** Reads what this app wrote, and nothing else: a draft that cannot be read is dropped, not guessed at. */
export function decodeDrafts(text: string | null, now: number): DraftState | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (body.v !== 1 || typeof body.ownerId !== 'string' || !Array.isArray(body.items)) return null;
  const items: Draft[] = [];
  for (const entry of body.items) {
    if (!entry || typeof entry !== 'object') continue;
    const draft = entry as Record<string, unknown>;
    const basket = draft.basket as Record<string, unknown> | undefined;
    if (
      typeof draft.id !== 'string' ||
      typeof draft.name !== 'string' ||
      typeof draft.savedAt !== 'number' ||
      !basket ||
      typeof basket.ownerId !== 'string' ||
      typeof basket.branchId !== 'string' ||
      typeof basket.savedAt !== 'number' ||
      !Array.isArray(basket.lines) ||
      basket.lines.length === 0 ||
      basket.lines.length > MAX_BASKET_LINES
    ) {
      continue;
    }
    items.push({ id: draft.id, name: draft.name.slice(0, MAX_NAME), basket: basket as unknown as Basket, savedAt: draft.savedAt });
  }
  const fresh = items.filter((draft) => now - draft.savedAt <= DRAFT_LIFETIME_MS).slice(0, MAX_DRAFTS);
  return fresh.length > 0 ? { ownerId: body.ownerId, items: fresh } : null;
}
