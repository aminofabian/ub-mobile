import { cartCents, MAX_UNITS, onShelfPrice, type CartItem, type CartLine } from './cart';
import { formatMoney, toCents } from './money';
import { howToSell, MAX_WEIGHT_THOUSANDTHS } from './weight';

/**
 * Held baskets: a sale put aside while the customer fetches one more thing, and picked up again. They live on the phone,
 * in the shop's own storage, so they survive the app closing. A basket belongs to the person who held it, at the
 * branch where they held it: the till is shared, and what one person left is not another's to ring up.
 */

export interface HeldBasket {
  id: string;
  /** "Basket 1", "Basket 2": the lowest number not in use by this person. */
  label: string;
  branchId: string;
  userId: string;
  /** ISO time it was put on hold. */
  heldAt: string;
  lines: CartLine[];
}

export interface HoldBook {
  baskets: HeldBasket[];
}

/** Who a held basket belongs to. */
export interface Holder {
  branchId: string;
  userId: string;
}

/** The most baskets one person may hold at one branch at once. */
export const MAX_HELD = 8;
/** How long a basket is kept: a customer who has not come back within a day is not coming back. */
export const HOLD_LIFETIME_MS = 24 * 60 * 60 * 1000;
/** The most lines one basket may have. */
export const MAX_HELD_LINES = 100;

const MAX_TEXT = 200;
const MAX_PRICE = 10_000_000;

export function emptyBook(): HoldBook {
  return { baskets: [] };
}

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value : null;
}

function validLine(raw: unknown): CartLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const line = raw as Record<string, unknown>;
  const itemId = text(line.itemId, 64);
  const name = text(line.name, MAX_TEXT);
  const { quantity, unitPrice, shelfPrice } = line;
  if (!itemId || !name) return null;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) return null;
  if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice <= 0 || unitPrice > MAX_PRICE) return null;
  const weighed = line.weighed === true;
  if (weighed) {
    const thousandths = Math.round(quantity * 1000);
    if (thousandths > MAX_WEIGHT_THOUSANDTHS || Math.abs(quantity * 1000 - thousandths) > 1e-6) return null;
  } else if (!Number.isInteger(quantity) || quantity > MAX_UNITS) {
    return null;
  }
  let shelf: number | undefined;
  if (shelfPrice !== undefined) {
    if (typeof shelfPrice !== 'number' || !Number.isFinite(shelfPrice) || shelfPrice <= 0 || shelfPrice > MAX_PRICE) return null;
    shelf = shelfPrice;
  }
  return {
    itemId,
    name,
    quantity,
    unitPrice,
    ...(weighed ? { weighed: true as const } : {}),
    ...(shelf !== undefined && toCents(shelf) !== toCents(unitPrice) ? { shelfPrice: shelf } : {}),
  };
}

function validBasket(raw: unknown): HeldBasket | null {
  if (!raw || typeof raw !== 'object') return null;
  const basket = raw as Record<string, unknown>;
  const id = text(basket.id, 64);
  const label = text(basket.label, 40);
  const branchId = text(basket.branchId, 64);
  const userId = text(basket.userId, 64);
  const heldAt = text(basket.heldAt, 40);
  if (!id || !label || !branchId || !userId || !heldAt || Number.isNaN(Date.parse(heldAt))) return null;
  if (!Array.isArray(basket.lines) || basket.lines.length === 0 || basket.lines.length > MAX_HELD_LINES) return null;
  const lines: CartLine[] = [];
  for (const rawLine of basket.lines) {
    const line = validLine(rawLine);
    if (!line) return null;
    lines.push(line);
  }
  if (new Set(lines.map((line) => line.itemId)).size !== lines.length) return null;
  return { id, label, branchId, userId, heldAt, lines };
}

export interface ParsedBook {
  book: HoldBook;
  /** Baskets dropped for being over a day old. */
  expired: number;
  /** Baskets dropped because what was stored for them cannot be read. */
  damaged: number;
}

/**
 * The stored baskets, read defensively: anything that is not a whole, sensible basket is dropped (never repaired by
 * guessing), baskets past their day are dropped, and one person never has more than `MAX_HELD` at a branch.
 */
export function parseHoldBook(raw: string | null, now: number): ParsedBook {
  const none: ParsedBook = { book: emptyBook(), expired: 0, damaged: 0 };
  if (!raw) return none;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return none;
  }
  const stored = parsed && typeof parsed === 'object' ? (parsed as { baskets?: unknown }).baskets : undefined;
  if (!Array.isArray(stored)) return none;
  let expired = 0;
  let damaged = 0;
  const seen = new Set<string>();
  const kept: HeldBasket[] = [];
  for (const entry of stored) {
    const basket = validBasket(entry);
    if (!basket || seen.has(basket.id)) {
      damaged += 1;
      continue;
    }
    if (now - Date.parse(basket.heldAt) > HOLD_LIFETIME_MS) {
      expired += 1;
      continue;
    }
    seen.add(basket.id);
    kept.push(basket);
  }
  kept.sort((a, b) => Date.parse(b.heldAt) - Date.parse(a.heldAt));
  const perHolder = new Map<string, number>();
  const baskets = kept.filter((basket) => {
    const key = JSON.stringify([basket.branchId, basket.userId]);
    const count = (perHolder.get(key) ?? 0) + 1;
    perHolder.set(key, count);
    if (count > MAX_HELD) {
      damaged += 1;
      return false;
    }
    return true;
  });
  return { book: { baskets }, expired, damaged };
}

export function serializeHoldBook(book: HoldBook): string {
  return JSON.stringify({ baskets: book.baskets });
}

function isMine(basket: HeldBasket, who: Holder): boolean {
  return basket.branchId === who.branchId && basket.userId === who.userId;
}

/** The baskets this person holds at this branch, the most recent first. */
export function basketsOf(book: HoldBook, who: Holder): HeldBasket[] {
  return book.baskets
    .filter((basket) => isMine(basket, who))
    .sort((a, b) => Date.parse(b.heldAt) - Date.parse(a.heldAt));
}

function freeLabel(mine: readonly HeldBasket[]): string {
  const used = new Set(mine.map((basket) => basket.label));
  for (let n = 1; ; n += 1) {
    const label = `Basket ${n}`;
    if (!used.has(label)) return label;
  }
}

export type HoldResult =
  | { ok: true; book: HoldBook; basket: HeldBasket }
  | { ok: false; reason: 'empty' | 'full' | 'big' };

/**
 * Puts the basket aside. Nothing to hold, a basket too big to be read back from the phone, or a person already at
 * `MAX_HELD`, is refused and changes nothing.
 */
export function holdCart(book: HoldBook, cart: readonly CartLine[], who: Holder, now: number, id: string): HoldResult {
  if (cart.length === 0) return { ok: false, reason: 'empty' };
  if (cart.length > MAX_HELD_LINES) return { ok: false, reason: 'big' };
  const mine = basketsOf(book, who);
  if (mine.length >= MAX_HELD) return { ok: false, reason: 'full' };
  const basket: HeldBasket = {
    id,
    label: freeLabel(mine),
    branchId: who.branchId,
    userId: who.userId,
    heldAt: new Date(now).toISOString(),
    lines: cart.map((line) => ({ ...line })),
  };
  return { ok: true, book: { baskets: [basket, ...book.baskets] }, basket };
}

/** Throws one basket away. Only the person who held it can. */
export function dropBasket(book: HoldBook, id: string, who: Holder): HoldBook {
  return { baskets: book.baskets.filter((basket) => !(basket.id === id && isMine(basket, who))) };
}

export interface Recalled {
  book: HoldBook;
  /** What is now in the basket in front of the cashier. */
  lines: CartLine[];
  basket: HeldBasket;
  /** The basket that was in front of the cashier, put aside so nothing is lost. Null when it was empty. */
  parked: HeldBasket | null;
}

/**
 * Picks a held basket up. A basket already being rung is put on hold first, so picking one up never throws a sale
 * away. Null when the basket is not there, is someone else's, or the basket in front of the cashier cannot be put aside.
 */
export function recallBasket(
  book: HoldBook,
  cart: readonly CartLine[],
  id: string,
  who: Holder,
  now: number,
  parkedId: string
): Recalled | null {
  const basket = book.baskets.find((candidate) => candidate.id === id && isMine(candidate, who));
  if (!basket) return null;
  const without = dropBasket(book, id, who);
  if (cart.length === 0) return { book: without, lines: basket.lines.map((line) => ({ ...line })), basket, parked: null };
  const parked = holdCart(without, cart, who, now, parkedId);
  if (!parked.ok) return null;
  return { book: parked.book, lines: basket.lines.map((line) => ({ ...line })), basket, parked: parked.basket };
}

/** What the held-baskets list says about one basket. */
export function describeBasket(basket: HeldBasket, now: number): { title: string; detail: string } {
  const minutes = Math.max(0, Math.floor((now - Date.parse(basket.heldAt)) / 60_000));
  const age = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`;
  const things = basket.lines.length === 1 ? '1 item' : `${basket.lines.length} items`;
  const cents = cartCents(basket.lines);
  const worth = cents === null ? '' : `${formatMoney(cents)} · `;
  return { title: basket.label, detail: `${things} · ${worth}${age}` };
}

/** What the till found out about an item since the basket was held: the item as it is now, null when it is no longer for sale. */
export type Freshness = Record<string, CartItem | null | undefined>;

export type RemovedBecause = 'gone' | 'changed' | 'blocked' | 'unpriced';

export interface RecallReport {
  repriced: { name: string; from: number; to: number }[];
  removed: { name: string; because: RemovedBecause }[];
  /** Lines whose price could not be checked: they stay as they were held. */
  unchecked: number;
}

/**
 * Brings a recalled basket up to date. A line follows the shelf price unless the cashier set their own price, which
 * stays. A line for an item that is no longer for sale, or is now sold another way (by weight instead of by the
 * unit), cannot be rung up as it was and is taken out, with the reason. A server treats any price that is not the
 * shelf price as the cashier's own, so an old price must never be sent as if it were the shelf's.
 */
export function refreshLines(lines: readonly CartLine[], fresh: Freshness): { lines: CartLine[]; report: RecallReport } {
  const report: RecallReport = { repriced: [], removed: [], unchecked: 0 };
  const out: CartLine[] = [];
  for (const line of lines) {
    const now = fresh[line.itemId];
    if (now === undefined) {
      report.unchecked += 1;
      out.push(line);
      continue;
    }
    if (now === null) {
      report.removed.push({ name: line.name, because: 'gone' });
      continue;
    }
    const how = howToSell(now);
    if (how.kind === 'blocked') {
      report.removed.push({ name: line.name, because: 'blocked' });
      continue;
    }
    if ((how.kind === 'kg') !== (line.weighed === true)) {
      report.removed.push({ name: line.name, because: 'changed' });
      continue;
    }
    if (!(now.sellingPrice > 0) || !Number.isFinite(now.sellingPrice)) {
      report.removed.push({ name: line.name, because: 'unpriced' });
      continue;
    }
    const wasShelf = line.shelfPrice ?? line.unitPrice;
    if (toCents(now.sellingPrice) === toCents(wasShelf)) {
      out.push(line);
      continue;
    }
    if (line.shelfPrice !== undefined) {
      // The cashier's own price stays. Only what it is measured against moves.
      out.push(
        toCents(line.unitPrice) === toCents(now.sellingPrice)
          ? onShelfPrice(line, line.unitPrice)
          : { ...line, shelfPrice: now.sellingPrice }
      );
      continue;
    }
    report.repriced.push({ name: line.name, from: line.unitPrice, to: now.sellingPrice });
    out.push({ ...line, unitPrice: now.sellingPrice });
  }
  return { lines: out, report };
}

const REMOVED_WORDS: Record<RemovedBecause, string> = {
  gone: 'is no longer for sale',
  changed: 'is now sold a different way',
  blocked: 'can no longer be sold here',
  unpriced: 'has no price now',
};

/** The notice shown after a basket is picked up, one sentence per thing that changed. Empty when nothing did. */
export function describeRecall(report: RecallReport): string[] {
  const notes: string[] = [];
  for (const change of report.repriced) {
    const from = toCents(change.from);
    const to = toCents(change.to);
    if (from !== null && to !== null) {
      notes.push(`${change.name} is now ${formatMoney(to)} (it was ${formatMoney(from)}).`);
    }
  }
  for (const gone of report.removed) {
    notes.push(`${gone.name} ${REMOVED_WORDS[gone.because]}, so it was taken out.`);
  }
  if (report.unchecked > 0) {
    notes.push(
      report.unchecked === 1
        ? 'One price could not be checked. It stays as it was held.'
        : `${report.unchecked} prices could not be checked. They stay as they were held.`
    );
  }
  return notes;
}
