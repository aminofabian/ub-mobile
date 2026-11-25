import type { CartItem } from './cart';

/**
 * The shop's price list as the phone keeps it, so that a till with no connection can still find a product, read its
 * price and sell it. It is a copy: it says when it was made, it is never used while the shop can be asked, and it
 * never carries what the shop paid for anything.
 */

/** What this layout is called. A copy written by a later version of the app says a higher number and is left alone. */
export const CATALOG_VERSION = 1;

/**
 * The most text one shop's copy may take on the phone. The sales waiting to be sent are kept in the same storage, and a
 * full phone is a phone that cannot save a sale, so the copy is the one that gives way: past this, the rest of the
 * list is left out and the copy says so.
 */
export const CATALOG_MAX_CHARS = 1_500_000;
/** The most products a copy holds, whatever their size. */
export const CATALOG_MAX_ROWS = 20_000;
/** The most rows an answer to a search holds. */
export const SEARCH_LIMIT = 50;
/** A price above this is not a price a till would ring up; a row that says so is damaged. */
const MAX_PRICE = 10_000_000;

export interface Catalog {
  /** The branch whose prices and stock these are. A till at another branch does not use it. */
  branchId: string;
  /** When the phone made the copy (the phone's clock, in ms). 0 when that is not known. */
  at: number;
  /** The shop has more products than the phone keeps: some are missing. */
  cut: boolean;
  /** Rows of the stored text that could not be read and were left out. */
  dropped: number;
  /** In the order the shop lists them (by name). */
  items: readonly CartItem[];
}

/** A copy opened for searching: the same, with what looking things up quickly needs. */
export interface OpenCatalog extends Catalog {
  /** Lower-case name and barcode of each item, in the same order. */
  readonly hay: readonly string[];
  readonly names: readonly string[];
  readonly byBarcode: ReadonlyMap<string, readonly number[]>;
}

const WEIGHED = 1;
const PACK = 2;

type Row = [string, string, string, number, number | null, number] | [string, string, string, number, number | null, number, string];

function rowOf(item: CartItem): Row {
  const flags = (item.weighed ? WEIGHED : 0) | (item.packageVariant ? PACK : 0);
  const base: [string, string, string, number, number | null, number] = [
    item.id,
    item.name,
    item.barcode ?? '',
    item.sellingPrice,
    typeof item.stockOnHand === 'number' && Number.isFinite(item.stockOnHand) ? item.stockOnHand : null,
    flags,
  ];
  return item.unitType ? [...base, item.unitType] : base;
}

/**
 * The text that is kept on the phone. Rows are kept in the order given until the text would pass `maxChars` or the
 * rows `CATALOG_MAX_ROWS`; the rest are left out and `cut` says so. Nothing is ever cut through the middle of a row.
 */
export function encodeCatalog(input: {
  branchId: string;
  at: number;
  items: readonly CartItem[];
  /** The shop has more than `items`: the list given is already a part. */
  cut?: boolean;
  maxChars?: number;
  maxRows?: number;
}): { text: string; kept: number; cut: boolean } {
  const maxChars = input.maxChars ?? CATALOG_MAX_CHARS;
  const maxRows = input.maxRows ?? CATALOG_MAX_ROWS;
  const head = `{"v":${CATALOG_VERSION},"branch":${JSON.stringify(input.branchId)},"at":${Math.trunc(input.at)},"rows":[`;
  // The closing: `],"cut":false}` is the longest.
  const tail = '],"cut":false}';
  const parts: string[] = [];
  let size = head.length + tail.length;
  let cut = input.cut === true;
  for (const item of input.items) {
    if (parts.length >= maxRows) {
      cut = true;
      break;
    }
    const part = JSON.stringify(rowOf(item));
    // A comma goes in front of every row but the first.
    const needs = part.length + (parts.length > 0 ? 1 : 0);
    if (size + needs > maxChars) {
      cut = true;
      break;
    }
    parts.push(part);
    size += needs;
  }
  return { text: `${head}${parts.join(',')}],"cut":${cut ? 'true' : 'false'}}`, kept: parts.length, cut };
}

function readRow(row: unknown): CartItem | null {
  if (!Array.isArray(row) || row.length < 6 || row.length > 7) return null;
  const [id, name, barcode, price, stock, flags, unit] = row as unknown[];
  if (typeof id !== 'string' || id.length === 0 || id.length > 80) return null;
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 200) return null;
  if (typeof barcode !== 'string' || barcode.length > 64) return null;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > MAX_PRICE) return null;
  if (stock !== null && (typeof stock !== 'number' || !Number.isFinite(stock))) return null;
  if (typeof flags !== 'number' || !Number.isInteger(flags) || flags < 0 || flags > (WEIGHED | PACK)) return null;
  if (unit !== undefined && (typeof unit !== 'string' || unit.length === 0 || unit.length > 12)) return null;
  return {
    id,
    name,
    ...(barcode ? { barcode } : {}),
    sellingPrice: price,
    ...(stock !== null ? { stockOnHand: stock } : {}),
    ...(flags & WEIGHED ? { weighed: true as const, ...(unit ? { unitType: unit } : {}) } : {}),
    ...(flags & PACK ? { packageVariant: true as const } : {}),
  };
}

/** What reading the stored text came to. */
export type CatalogRead =
  | { kind: 'none' }
  /** There is text and it is not a copy this version can use: left as found, and a new copy takes its place. */
  | { kind: 'unreadable' }
  /** Written by a later version of the app. Not used here: it is a copy, and a new one is made in its place. */
  | { kind: 'newer' }
  | { kind: 'copy'; catalog: Catalog };

/** How far ahead of the phone's clock a copy's time may be before the time is not believed (a clock that was set back). */
const CLOCK_SLACK_MS = 5 * 60_000;

/**
 * Reads the stored text back. Whatever cannot be read is left out and counted, never repaired by guessing: a row that
 * is missing a price is not given one. A text that is not a copy at all, or has no readable row, is `unreadable`.
 */
export function parseCatalog(text: string | null, now: number): CatalogRead {
  if (text === null || text === '') return { kind: 'none' };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { kind: 'unreadable' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { kind: 'unreadable' };
  const record = value as Record<string, unknown>;
  if (typeof record.v === 'number' && Number.isInteger(record.v) && record.v > CATALOG_VERSION) return { kind: 'newer' };
  if (record.v !== CATALOG_VERSION) return { kind: 'unreadable' };
  if (typeof record.branch !== 'string' || record.branch.length === 0) return { kind: 'unreadable' };
  if (typeof record.at !== 'number' || !Number.isFinite(record.at) || record.at < 0) return { kind: 'unreadable' };
  if (!Array.isArray(record.rows)) return { kind: 'unreadable' };

  const seen = new Set<string>();
  const items: CartItem[] = [];
  let dropped = 0;
  for (const raw of record.rows as unknown[]) {
    const item = readRow(raw);
    if (!item || seen.has(item.id)) {
      dropped += 1;
      continue;
    }
    seen.add(item.id);
    items.push(item);
  }
  if (items.length === 0) return { kind: 'unreadable' };
  return {
    kind: 'copy',
    catalog: {
      branchId: record.branch,
      // A time ahead of the phone's own clock is not a time the copy was made.
      at: record.at > now + CLOCK_SLACK_MS ? 0 : Math.trunc(record.at),
      cut: record.cut === true,
      dropped,
      items,
    },
  };
}

/** Gets a copy ready for looking things up. */
export function openCatalog(catalog: Catalog): OpenCatalog {
  const hay: string[] = [];
  const names: string[] = [];
  const byBarcode = new Map<string, number[]>();
  catalog.items.forEach((item, index) => {
    const name = item.name.toLowerCase();
    names.push(name);
    hay.push(item.barcode ? `${name} ${item.barcode.toLowerCase()}` : name);
    if (item.barcode) {
      const same = byBarcode.get(item.barcode);
      if (same) same.push(index);
      else byBarcode.set(item.barcode, [index]);
    }
  });
  return { ...catalog, hay, names, byBarcode };
}

/** A letter of any alphabet that has capitals, or a digit. Not a space, a dash, a slash or a bracket. */
function isWordCharacter(character: string): boolean {
  return character.toLowerCase() !== character.toUpperCase() || (character >= '0' && character <= '9');
}

function startsAWord(name: string, term: string): boolean {
  let from = name.indexOf(term);
  while (from !== -1) {
    if (from === 0 || !isWordCharacter(name.charAt(from - 1))) return true;
    from = name.indexOf(term, from + 1);
  }
  return false;
}

/**
 * What a search for `query` finds in the copy. Every word typed has to be somewhere in the name or the barcode. The
 * barcode itself comes first, then names that start with what was typed, then names with a word that starts with it,
 * then the rest; within each, the shop's own order. Nothing typed gives the first of the list.
 */
export function searchCatalog(catalog: OpenCatalog, query: string, limit: number = SEARCH_LIMIT): CartItem[] {
  const typed = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (typed === '') return catalog.items.slice(0, limit);
  const terms = typed.split(' ').slice(0, 6);
  const first = terms[0] ?? typed;
  const found: { at: number; rank: number }[] = [];
  for (let at = 0; at < catalog.items.length; at += 1) {
    const hay = catalog.hay[at] ?? '';
    if (!terms.every((term) => hay.includes(term))) continue;
    const item = catalog.items[at];
    const name = catalog.names[at] ?? '';
    let rank = 3;
    if (item?.barcode !== undefined && item.barcode.toLowerCase() === typed) rank = 0;
    else if (name.startsWith(typed)) rank = 1;
    else if (startsAWord(name, first)) rank = 2;
    found.push({ at, rank });
  }
  found.sort((a, b) => a.rank - b.rank || a.at - b.at);
  const out: CartItem[] = [];
  for (const { at } of found.slice(0, limit)) {
    const item = catalog.items[at];
    if (item) out.push(item);
  }
  return out;
}

/** The products whose barcode is exactly `code`. */
export function findByBarcode(catalog: OpenCatalog, code: string): CartItem[] {
  const at = catalog.byBarcode.get(code.trim());
  if (!at) return [];
  const out: CartItem[] = [];
  for (const index of at) {
    const item = catalog.items[index];
    if (item) out.push(item);
  }
  return out;
}

/** How long a copy is trusted to be worth keeping as it is, before the till makes a new one on its own. */
export const REFRESH_AFTER_MS = 12 * 60 * 60_000;
/** How long after a copy could not be made the till waits before it tries again on its own. */
export const RETRY_AFTER_MS = 10 * 60_000;

/**
 * Whether the till should make a new copy now, on its own. Never while the line is believed down, never while one is
 * being made, and not again straight after a try that failed. Otherwise: when there is no copy for this branch (a
 * copy of another branch's list is of no use here), when the copy's time is not to be believed, or when it is old.
 */
export function shouldRefresh(input: {
  catalog: Catalog | null;
  branchId: string;
  now: number;
  offline: boolean;
  busy: boolean;
  /** When the last attempt failed. */
  failedAt: number | null;
}): boolean {
  const { catalog, branchId, now, offline, busy, failedAt } = input;
  if (offline || busy) return false;
  if (failedAt !== null && now - failedAt < RETRY_AFTER_MS) return false;
  if (!catalog || catalog.branchId !== branchId) return true;
  // A copy with no known time, or one that claims to be from the future, is not kept on trust.
  if (catalog.at <= 0 || catalog.at > now) return true;
  return now - catalog.at >= REFRESH_AFTER_MS;
}
