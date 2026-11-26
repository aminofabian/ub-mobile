import { cleanDisplayText, itemLabel, MAX_QTY_UNITS, QTY_SCALE } from '@kiosk/core';

/**
 * The sale being put together at the counter. Money is whole cents and quantity is ten-thousandths of a unit,
 * both integers, so a basket adds up the same on the phone as it does at the server (which rounds each line to two
 * decimals, half up). The basket is kept on the phone, so a call, a locked screen or a dropped app does not lose it,
 * and it belongs to one person at one branch: someone else signing in does not get it.
 */

export type BasketLine = {
  /** Made on the phone. Names the line on the screen; the server never sees it. */
  lineId: string;
  itemId: string;
  name: string;
  unitName: string;
  weighed: boolean;
  quantityUnits: number;
  unitCents: number;
};

export type Basket = {
  ownerId: string;
  branchId: string;
  savedAt: number;
  lines: BasketLine[];
};

export const MAX_BASKET_LINES = 100;
/** The most one line can come to: ten billion shillings. A slipped finger, not a sale. */
export const MAX_LINE_CENTS = 1_000_000_000_000;
export const BASKET_LIFETIME_MS = 24 * 60 * 60_000;

/** What one line costs, in cents, rounded half up as the server rounds a line. Both numbers are whole. */
export function lineTotalCents(quantityUnits: number, unitCents: number): number {
  return Number((BigInt(quantityUnits) * BigInt(unitCents) + BigInt(5000)) / BigInt(10000));
}

export function basketTotalCents(basket: { lines: readonly BasketLine[] }): number {
  return basket.lines.reduce((sum, line) => sum + lineTotalCents(line.quantityUnits, line.unitCents), 0);
}

export function emptyBasket(owner: { ownerId: string; branchId: string }, now: number): Basket {
  return { ownerId: owner.ownerId, branchId: owner.branchId, savedAt: now, lines: [] };
}

/** The basket for whoever is at the counter. Another person's, or another branch's, is not theirs and is let go. */
export function claimBasket(basket: Basket | null, owner: { ownerId: string; branchId: string }, now: number): Basket {
  if (basket && basket.ownerId === owner.ownerId && basket.branchId === owner.branchId && now - basket.savedAt <= BASKET_LIFETIME_MS) {
    return basket;
  }
  return emptyBasket(owner, now);
}

export type SaleItem = {
  id: string;
  name: string;
  variantName: string | null;
  weighed: boolean;
  unitType: string | null;
  active: boolean;
  sellable: boolean;
  sellingCents: number | null;
};

export type BasketProblem = 'not_for_sale' | 'no_price' | 'bad_quantity' | 'fraction' | 'too_precise' | 'too_big' | 'too_many_lines' | 'no_line';

export const basketProblemWords: Record<BasketProblem, string> = {
  not_for_sale: 'This item is not for sale.',
  no_price: 'This item has no selling price yet, so it cannot be sold. Ask the manager to set one.',
  bad_quantity: 'Enter how many, as a number above zero.',
  fraction: 'This item is sold whole, not by weight. Enter a whole number.',
  too_precise: 'Weights go to three decimals at most, like 1.25 or 0.375.',
  too_big: 'That is more than one line can hold. Check the quantity.',
  too_many_lines: `A sale holds up to ${MAX_BASKET_LINES} different items. Send this one first, then start another.`,
  no_line: 'That line is no longer in the basket.',
};

/** The smallest weight a sale can carry: a thousandth, in ten-thousandths. The invoice keeps weights to three decimals and rounds a fourth, so a sale rung up to four would come to a little more or less at the till than the phone said. */
const WEIGHT_STEP = QTY_SCALE / 1000;

function quantityProblem(units: number, weighed: boolean): BasketProblem | null {
  if (!Number.isInteger(units) || units <= 0) return 'bad_quantity';
  if (!weighed && units % QTY_SCALE !== 0) return 'fraction';
  if (units > MAX_QTY_UNITS) return 'too_big';
  if (weighed && units % WEIGHT_STEP !== 0) return 'too_precise';
  return null;
}

type Changed = { ok: true; basket: Basket; lineId: string } | { ok: false; why: BasketProblem };

/**
 * Puts an item in the basket. The same item again adds to its line, at the price the line already has. `lineId` names
 * a new line.
 */
export function addItem(basket: Basket, item: SaleItem, units: number, now: number, lineId: string): Changed {
  if (!item.active || !item.sellable) return { ok: false, why: 'not_for_sale' };
  if (item.sellingCents === null || item.sellingCents <= 0) return { ok: false, why: 'no_price' };
  const existing = basket.lines.find((line) => line.itemId === item.id);
  const wanted = (existing?.quantityUnits ?? 0) + units;
  const problem = quantityProblem(units, item.weighed) ?? quantityProblem(wanted, item.weighed);
  if (problem) return { ok: false, why: problem };
  if (existing) {
    if (lineTotalCents(wanted, existing.unitCents) > MAX_LINE_CENTS) return { ok: false, why: 'too_big' };
    const lines = basket.lines.map((line) => (line === existing ? { ...line, quantityUnits: wanted } : line));
    return { ok: true, basket: { ...basket, lines, savedAt: now }, lineId: existing.lineId };
  }
  if (basket.lines.length >= MAX_BASKET_LINES) return { ok: false, why: 'too_many_lines' };
  if (lineTotalCents(units, item.sellingCents) > MAX_LINE_CENTS) return { ok: false, why: 'too_big' };
  const line: BasketLine = {
    lineId,
    itemId: item.id,
    name: cleanDisplayText(itemLabel(item), 120) || 'Item',
    unitName: cleanDisplayText(item.unitType, 24) || 'each',
    weighed: item.weighed,
    quantityUnits: units,
    unitCents: item.sellingCents,
  };
  return { ok: true, basket: { ...basket, lines: [...basket.lines, line], savedAt: now }, lineId };
}

/** Sets a line's quantity. Taking a line out is `removeLine`, never a quantity of zero. */
export function setQuantity(basket: Basket, lineId: string, units: number, now: number): Changed {
  const line = basket.lines.find((candidate) => candidate.lineId === lineId);
  if (!line) return { ok: false, why: 'no_line' };
  const problem = quantityProblem(units, line.weighed);
  if (problem) return { ok: false, why: problem };
  if (lineTotalCents(units, line.unitCents) > MAX_LINE_CENTS) return { ok: false, why: 'too_big' };
  if (units === line.quantityUnits) return { ok: true, basket, lineId };
  const lines = basket.lines.map((candidate) => (candidate === line ? { ...candidate, quantityUnits: units } : candidate));
  return { ok: true, basket: { ...basket, lines, savedAt: now }, lineId };
}

export function removeLine(basket: Basket, lineId: string, now: number): Basket {
  if (!basket.lines.some((line) => line.lineId === lineId)) return basket;
  return { ...basket, lines: basket.lines.filter((line) => line.lineId !== lineId), savedAt: now };
}

export function clearBasket(basket: Basket, now: number): Basket {
  return basket.lines.length === 0 ? basket : { ...basket, lines: [], savedAt: now };
}

// ---------------------------------------------------------------------------------------------
// Kept on the phone
// ---------------------------------------------------------------------------------------------

export function encodeBasket(basket: Basket | null): string | null {
  if (!basket || basket.lines.length === 0) return null;
  return JSON.stringify({ v: 1, ...basket });
}

function isText(value: unknown, max = 200): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/** One line as kept on the phone, or null when it is not a line this app could have written. Shared with the send queue. */
export function readKeptLine(raw: unknown): BasketLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const line = raw as Record<string, unknown>;
  if (!isText(line.lineId) || !isText(line.itemId) || typeof line.name !== 'string' || !isText(line.unitName, 24) || typeof line.weighed !== 'boolean') return null;
  const { quantityUnits, unitCents } = line;
  if (typeof quantityUnits !== 'number' || !Number.isInteger(quantityUnits) || quantityUnits <= 0 || quantityUnits > MAX_QTY_UNITS) return null;
  if (typeof unitCents !== 'number' || !Number.isInteger(unitCents) || unitCents <= 0 || unitCents > 1_000_000_000) return null;
  if (lineTotalCents(quantityUnits, unitCents) > MAX_LINE_CENTS) return null;
  return { lineId: line.lineId, itemId: line.itemId, name: line.name, unitName: line.unitName, weighed: line.weighed, quantityUnits, unitCents };
}

/** The basket kept on the phone. Null when there is none, it is unreadable, or it is a day old: a past shift's cart. */
export function decodeBasket(text: string | null, now: number): Basket | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (body.v !== 1 || !isText(body.ownerId) || !isText(body.branchId) || typeof body.savedAt !== 'number' || !Array.isArray(body.lines)) return null;
  if (body.lines.length > MAX_BASKET_LINES || now - body.savedAt > BASKET_LIFETIME_MS) return null;
  const lines: BasketLine[] = [];
  for (const row of body.lines) {
    const line = readKeptLine(row);
    if (!line) return null;
    lines.push(line);
  }
  return { ownerId: body.ownerId, branchId: body.branchId, savedAt: body.savedAt, lines };
}
