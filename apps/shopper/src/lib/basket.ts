/**
 * The basket, held on the phone first.
 *
 * Until now every tap on "add" was a call to the shop, and a tap with no signal did nothing at all. Here the
 * shopper's quantities are kept on the phone and shown at once; the shop's cart is a copy that follows them.
 * Each line remembers what the shop is known to hold (`sent`), so what is still to be told to the shop is
 * exactly the lines where the two differ, and a lost signal, a closed app or a cart the shop has dropped
 * loses nothing.
 *
 * What the shop says is still the truth about prices and totals: its answer replaces what was shown, and
 * until it has answered about the latest taps the total is marked as an estimate. An order is only placed
 * from a basket the shop has fully heard and priced (`readyToOrder`), the way the website checks its cart.
 *
 * No imports, so node can run this file's test directly.
 */
export interface BasketLine {
  itemId: string;
  name: string;
  variantName: string | null;
  imageUrl: string | null;
  /** What the shopper wants. */
  quantity: number;
  /** As the shop last said, or as the product showed when it was added; null when not known yet. */
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface Basket {
  /** The shop's cart this basket follows, once there is one. */
  cartId: string | null;
  currency: string;
  lines: BasketLine[];
  /** What the shop's cart is known to hold: item to quantity. */
  sent: Record<string, number>;
  /** The shop's total for what it holds, as of its last answer. */
  subtotal: number | null;
  answeredAt: string | null;
  /** When the shop's cart lapses, as of its last answer. */
  cartExpiresAt: string | null;
  /** Lines the shop would not take, with its reason, until the shopper changes them. */
  refused: Record<string, string>;
  updatedAt: string;
}

export interface ItemFacts {
  itemId: string;
  name: string;
  variantName?: string | null;
  imageUrl?: string | null;
  unitPrice?: number | null;
}

export interface ServerLine {
  itemId?: string;
  name?: string;
  variantName?: string | null;
  imageUrl?: string | null;
  quantity?: number;
  unitPrice?: number | null;
  lineTotal?: number | null;
}

export interface ServerCart {
  id?: string;
  currency?: string;
  expiresAt?: string;
  subtotal?: number | null;
  lines?: ServerLine[];
}

export interface Change {
  itemId: string;
  quantity: number;
}

const DEFAULT_CURRENCY = 'KES';

export function emptyBasket(now: Date): Basket {
  return {
    cartId: null,
    currency: DEFAULT_CURRENCY,
    lines: [],
    sent: {},
    subtotal: null,
    answeredAt: null,
    cartExpiresAt: null,
    refused: {},
    updatedAt: now.toISOString(),
  };
}

const money = (value: number) => Math.round(value * 100) / 100;
const qty = (value: number) => Math.round(value * 10_000) / 10_000;

export function quantityOf(basket: Basket, itemId: string): number {
  return basket.lines.find((line) => line.itemId === itemId)?.quantity ?? 0;
}

export function itemCount(basket: Basket): number {
  return basket.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** The shopper changes a quantity. Zero takes the line out. A line the shop refused is tried again. */
export function setQuantity(basket: Basket, item: ItemFacts, quantity: number, now: Date): Basket {
  const wanted = Number.isFinite(quantity) ? Math.max(0, qty(quantity)) : 0;
  const { [item.itemId]: _dropped, ...refused } = basket.refused;
  const existing = basket.lines.find((line) => line.itemId === item.itemId);
  let lines: BasketLine[];
  if (wanted === 0) {
    lines = basket.lines.filter((line) => line.itemId !== item.itemId);
  } else if (existing) {
    const unitPrice = existing.unitPrice;
    lines = basket.lines.map((line) =>
      line.itemId === item.itemId
        ? { ...line, quantity: wanted, lineTotal: unitPrice === null ? null : money(unitPrice * wanted) }
        : line,
    );
  } else {
    const unitPrice = item.unitPrice ?? null;
    lines = [
      ...basket.lines,
      {
        itemId: item.itemId,
        name: item.name,
        variantName: item.variantName ?? null,
        imageUrl: item.imageUrl ?? null,
        quantity: wanted,
        unitPrice,
        lineTotal: unitPrice === null ? null : money(unitPrice * wanted),
      },
    ];
  }
  return { ...basket, lines, refused, updatedAt: now.toISOString() };
}

/** What the shop still has to be told, in the order of the lines, removals last. */
export function pendingChanges(basket: Basket): Change[] {
  const changes: Change[] = [];
  for (const line of basket.lines) {
    if (basket.refused[line.itemId] !== undefined) continue;
    if ((basket.sent[line.itemId] ?? 0) !== line.quantity) changes.push({ itemId: line.itemId, quantity: line.quantity });
  }
  const kept = new Set(basket.lines.map((line) => line.itemId));
  for (const itemId of Object.keys(basket.sent).sort()) {
    if (!kept.has(itemId) && (basket.sent[itemId] ?? 0) > 0) changes.push({ itemId, quantity: 0 });
  }
  return changes;
}

export function hasPending(basket: Basket): boolean {
  return pendingChanges(basket).length > 0;
}

/**
 * The line the shopper changed while a call about it was out, if they did. The call took the quantity it was
 * sent with; if the line has another quantity now, the shop's answer is about a quantity the shopper no
 * longer wants, even when the new one is what the shop held before, which would look like nothing to tell.
 */
export function changedSince(basket: Basket, sent: Change): ReadonlySet<string> {
  return quantityOf(basket, sent.itemId) === sent.quantity ? NONE : new Set([sent.itemId]);
}

const NONE: ReadonlySet<string> = new Set();

/**
 * The shop answered with its whole cart. What it says about prices, names and totals is taken. What the
 * shopper wants is not overwritten while the shop has not yet been told: a quantity changed since the last
 * answer, one the shop refused, or one changed while the call was out (`touched`), stays as the shopper left it.
 */
export function acceptAnswer(basket: Basket, cart: ServerCart, now: Date, touched: ReadonlySet<string> = NONE): Basket {
  const localWins = new Set<string>([
    ...pendingChanges(basket).map((change) => change.itemId),
    ...Object.keys(basket.refused),
    ...touched,
  ]);
  const server = new Map<string, ServerLine>();
  for (const line of cart.lines ?? []) {
    if (line.itemId) server.set(line.itemId, line);
  }

  const merged: BasketLine[] = [];
  const seen = new Set<string>();
  const fromServer = (line: BasketLine, theirs: ServerLine): BasketLine => {
    const quantity = localWins.has(line.itemId) ? line.quantity : (theirs.quantity ?? line.quantity);
    const unitPrice = theirs.unitPrice ?? null;
    const agrees = quantity === (theirs.quantity ?? quantity);
    return {
      itemId: line.itemId,
      name: theirs.name ?? line.name,
      variantName: theirs.variantName ?? line.variantName,
      imageUrl: theirs.imageUrl ?? line.imageUrl,
      quantity,
      unitPrice,
      lineTotal: agrees ? (theirs.lineTotal ?? null) : unitPrice === null ? null : money(unitPrice * quantity),
    };
  };

  for (const line of basket.lines) {
    seen.add(line.itemId);
    const theirs = server.get(line.itemId);
    if (theirs) merged.push(fromServer(line, theirs));
    else if (localWins.has(line.itemId)) merged.push(line);
    // else: the shop no longer holds it and the shopper has not touched it since, so it is gone.
  }
  for (const [itemId, theirs] of server) {
    if (seen.has(itemId) || localWins.has(itemId)) continue;
    merged.push({
      itemId,
      name: theirs.name ?? 'Item',
      variantName: theirs.variantName ?? null,
      imageUrl: theirs.imageUrl ?? null,
      quantity: theirs.quantity ?? 0,
      unitPrice: theirs.unitPrice ?? null,
      lineTotal: theirs.lineTotal ?? null,
    });
  }

  const sent: Record<string, number> = {};
  for (const [itemId, theirs] of server) sent[itemId] = theirs.quantity ?? 0;

  return {
    ...basket,
    cartId: cart.id ?? basket.cartId,
    currency: cart.currency ?? basket.currency,
    lines: merged.filter((line) => line.quantity > 0),
    sent,
    subtotal: cart.subtotal ?? null,
    answeredAt: now.toISOString(),
    cartExpiresAt: cart.expiresAt ?? null,
    updatedAt: now.toISOString(),
  };
}

/** The shop would not take this line. Its words are kept with the line, which is not sent again until changed. */
export function refuse(basket: Basket, itemId: string, reason: string, now: Date): Basket {
  return { ...basket, refused: { ...basket.refused, [itemId]: reason }, updatedAt: now.toISOString() };
}

/** The shop's cart is gone (expired, or ordered). The lines stay, and are told to a new cart. */
export function forgetCart(basket: Basket, now: Date): Basket {
  return {
    ...basket,
    cartId: null,
    sent: {},
    subtotal: null,
    answeredAt: null,
    cartExpiresAt: null,
    updatedAt: now.toISOString(),
  };
}

export function clearBasket(now: Date): Basket {
  return emptyBasket(now);
}

export interface BasketView {
  currency: string;
  subtotal: number | null;
  /** The total is the phone's reckoning, not the shop's: something has not been told to the shop yet. */
  isEstimate: boolean;
  waiting: boolean;
}

export function viewOf(basket: Basket): BasketView {
  const waiting = hasPending(basket);
  const refused = Object.keys(basket.refused).length > 0;
  if (!waiting && !refused) {
    // Nothing in the basket and nothing to tell the shop: the total is nought, and nobody is guessing.
    if (basket.lines.length === 0) return { currency: basket.currency, subtotal: 0, isEstimate: false, waiting };
    if (basket.subtotal !== null) return { currency: basket.currency, subtotal: basket.subtotal, isEstimate: false, waiting };
  }
  const priced = basket.lines.every((line) => line.lineTotal !== null);
  const total = priced ? money(basket.lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0)) : null;
  return { currency: basket.currency, subtotal: total, isEstimate: true, waiting };
}

export type NotReady = 'empty' | 'waiting' | 'refused' | 'unpriced' | 'no-cart' | 'lapsed';

/** How soon before the cart's end it is treated as gone, so an order is not placed on a cart about to lapse. */
export const LAPSE_MARGIN_MS = 60_000;

/**
 * Whether an order can be placed from this basket: the shop holds all of it, has priced all of it, and its
 * cart is still there. The website refuses a cart "missing prices or expired" the same way.
 */
export function readyToOrder(basket: Basket, now: Date): { ready: true } | { ready: false; why: NotReady } {
  if (basket.lines.length === 0) return { ready: false, why: 'empty' };
  if (Object.keys(basket.refused).length > 0) return { ready: false, why: 'refused' };
  if (hasPending(basket)) return { ready: false, why: 'waiting' };
  if (basket.cartId === null) return { ready: false, why: 'no-cart' };
  if (basket.cartExpiresAt !== null && Date.parse(basket.cartExpiresAt) - now.getTime() <= LAPSE_MARGIN_MS) {
    return { ready: false, why: 'lapsed' };
  }
  if (basket.subtotal === null || basket.lines.some((line) => line.unitPrice === null)) return { ready: false, why: 'unpriced' };
  return { ready: true };
}

/** When to try the shop again after it did not answer: 5 s, then 10, 20, 40, and a minute from then on. */
export function nextRetryDelayMs(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(60_000, 5_000 * 2 ** (failures - 1));
}

export function serializeBasket(basket: Basket): string {
  return JSON.stringify({ v: 1, ...basket });
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function str(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** The basket as it was kept. Damaged data is an empty basket, and a damaged line is left out. */
export function parseBasket(raw: string | null | undefined, now: Date): Basket {
  if (!raw) return emptyBasket(now);
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return emptyBasket(now);
    const lines: BasketLine[] = [];
    const seen = new Set<string>();
    if (Array.isArray(parsed.lines)) {
      for (const entry of parsed.lines as Array<Record<string, unknown>>) {
        const itemId = str(entry?.itemId, 64);
        const quantity = num(entry?.quantity);
        if (!itemId || quantity === null || quantity <= 0 || seen.has(itemId)) continue;
        seen.add(itemId);
        lines.push({
          itemId,
          name: str(entry.name, 255) || 'Item',
          variantName: entry.variantName ? str(entry.variantName, 255) : null,
          imageUrl: entry.imageUrl ? str(entry.imageUrl, 1000) : null,
          quantity: qty(quantity),
          unitPrice: num(entry.unitPrice),
          lineTotal: num(entry.lineTotal),
        });
      }
    }
    const sent: Record<string, number> = {};
    if (parsed.sent && typeof parsed.sent === 'object') {
      for (const [itemId, value] of Object.entries(parsed.sent as Record<string, unknown>)) {
        const quantity = num(value);
        if (quantity !== null && quantity > 0) sent[itemId] = quantity;
      }
    }
    const refused: Record<string, string> = {};
    if (parsed.refused && typeof parsed.refused === 'object') {
      for (const [itemId, value] of Object.entries(parsed.refused as Record<string, unknown>)) {
        if (seen.has(itemId) && typeof value === 'string') refused[itemId] = value.slice(0, 240);
      }
    }
    return {
      cartId: parsed.cartId ? str(parsed.cartId, 64) || null : null,
      currency: str(parsed.currency, 8) || DEFAULT_CURRENCY,
      lines,
      sent,
      subtotal: num(parsed.subtotal),
      answeredAt: parsed.answeredAt ? str(parsed.answeredAt, 40) : null,
      cartExpiresAt: parsed.cartExpiresAt ? str(parsed.cartExpiresAt, 40) : null,
      refused,
      updatedAt: str(parsed.updatedAt, 40) || now.toISOString(),
    };
  } catch {
    return emptyBasket(now);
  }
}
