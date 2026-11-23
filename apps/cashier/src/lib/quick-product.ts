import { cleanDisplayText, isApiError } from '@kiosk/core';
import { fromCents, parseMoney } from './money';
import { serverWords } from './server-words';
import { parseWeightKg, thousandthsToKg } from './weight';

/**
 * Adding a product from the till: a name, a price, what kind of product it is, and how many are on the shelf. The
 * rules here are the server's own (what it requires, what it ignores), so a form that passes here is one the server
 * takes. Anything more (photos, packs, suppliers) is the owner's, in the web catalogue.
 */

export interface ItemType {
  id: string;
  name: string;
}

/** The kinds of product the shop has (`GET /api/v1/item-types`): a bare list, or a page. Unreadable rows are left out. */
export function parseItemTypes(response: unknown): ItemType[] {
  const rows = Array.isArray(response)
    ? response
    : response && typeof response === 'object' && Array.isArray((response as { content?: unknown }).content)
      ? ((response as { content: unknown[] }).content)
      : [];
  const types: ItemType[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const name = cleanDisplayText(record.name, 60);
    if (id && id.length <= 64 && name) types.push({ id, name });
  }
  return types.sort((a, b) => a.name.localeCompare(b.name));
}

export interface ProductForm {
  name: string;
  price: string;
  /** What it cost, for the owner's margins. Optional. */
  cost: string;
  barcode: string;
  /** How many are on the shelf now. Empty leaves it to the server, which starts a new product at 1. */
  stock: string;
  typeId: string | null;
  /** Sold by weight, in kilograms. */
  byWeight: boolean;
}

export const EMPTY_FORM: ProductForm = { name: '', price: '', cost: '', barcode: '', stock: '', typeId: null, byWeight: false };

/** The request the server takes to add a product at this till's branch (`POST /api/v1/pos/quick-items`). */
export interface QuickCreateBody {
  name: string;
  itemTypeId: string;
  branchId: string;
  unitType: 'each' | 'kg';
  unitPrice: number;
  buyingPrice?: number;
  barcode?: string;
  initialStockQty?: number;
}

export type ProductField = 'name' | 'type' | 'price' | 'cost' | 'barcode' | 'stock';

export type ProductCheck =
  | { ok: true; body: QuickCreateBody; byWeight: boolean }
  | { ok: false; field: ProductField; words: string };

const MAX_NAME_CHARACTERS = 120;
const BARCODE = /^[A-Za-z0-9._-]{4,64}$/;
const WHOLE_STOCK = /^\d{1,5}$/;

/** Reads the form: the first thing wrong with it, in words for the cashier, or the request to send. */
export function checkProduct(form: ProductForm, branchId: string, types: readonly ItemType[]): ProductCheck {
  const name = cleanDisplayText(form.name, 500);
  if (name.length < 2) return { ok: false, field: 'name', words: 'Enter the product name.' };
  if ([...name].length > MAX_NAME_CHARACTERS) {
    return { ok: false, field: 'name', words: `Use ${MAX_NAME_CHARACTERS} characters or fewer for the name.` };
  }
  const type = types.find((candidate) => candidate.id === form.typeId);
  if (!type) return { ok: false, field: 'type', words: 'Choose what kind of product it is.' };

  const cents = parseMoney(form.price);
  if (cents === null) return { ok: false, field: 'price', words: 'Enter the selling price, like 120 or 120.50.' };
  if (cents < 1) return { ok: false, field: 'price', words: 'The selling price must be above zero.' };

  let buyingPrice: number | undefined;
  if (form.cost.trim() !== '') {
    const cost = parseMoney(form.cost);
    if (cost === null) return { ok: false, field: 'cost', words: 'Enter the cost like 80 or 80.50, or leave it empty.' };
    if (cost > 0) buyingPrice = fromCents(cost);
  }

  const barcode = form.barcode.trim();
  if (barcode !== '' && !BARCODE.test(barcode)) {
    return { ok: false, field: 'barcode', words: 'A barcode is letters and digits, 4 to 64 of them, with no spaces.' };
  }

  let initialStockQty: number | undefined;
  const stock = form.stock.trim();
  if (stock !== '') {
    if (form.byWeight) {
      const weight = parseWeightKg(stock);
      if (!weight.ok) return { ok: false, field: 'stock', words: 'Enter the weight on the shelf in kg, like 12.5.' };
      initialStockQty = thousandthsToKg(weight.thousandths);
    } else {
      if (!WHOLE_STOCK.test(stock) || Number(stock) < 1) {
        return { ok: false, field: 'stock', words: 'Enter how many are on the shelf as a whole number, like 12.' };
      }
      initialStockQty = Number(stock);
    }
  }

  return {
    ok: true,
    byWeight: form.byWeight,
    body: {
      name,
      itemTypeId: type.id,
      branchId,
      unitType: form.byWeight ? 'kg' : 'each',
      unitPrice: fromCents(cents),
      ...(buyingPrice !== undefined ? { buyingPrice } : {}),
      ...(barcode !== '' ? { barcode } : {}),
      ...(initialStockQty !== undefined ? { initialStockQty } : {}),
    },
  };
}

export type CreateFailure =
  /** The server turned it down: nothing was added. */
  | { kind: 'refused'; words: string }
  /** The request may or may not have been recorded: look before trying again. */
  | { kind: 'unknown'; words: string };

/**
 * What to tell the cashier when adding a product did not work. A request that got no answer may have been recorded,
 * and the server does not make adding a product safe to repeat (it would count the opening stock twice), so the
 * cashier is sent to look for the product before adding it again.
 */
export function describeCreateFailure(error: unknown): CreateFailure {
  if (isApiError(error) && !error.foreign) {
    if (error.status === 403) {
      return { kind: 'refused', words: 'Your role is not allowed to add products here. Ask the owner to allow it.' };
    }
    if (error.status === 409) {
      return { kind: 'refused', words: 'This clashes with a product that already exists. Check the barcode and the name.' };
    }
    if (error.status >= 400 && error.status < 500) {
      const said = serverWords(error.message, 160);
      return { kind: 'refused', words: said ? `The server said no: ${said}` : 'The server did not accept this product. Check it and try again.' };
    }
  }
  return {
    kind: 'unknown',
    words: 'No answer from the server, so the product may have been added. Search for it before adding it again.',
  };
}

/** What to tell the cashier when the product was added but could not be marked as sold by weight. */
export function weighedFailureWords(error: unknown): string {
  if (isApiError(error) && !error.foreign && error.status === 403) {
    return 'The product was added, but your role is not allowed to mark it as sold by weight. Ask the owner.';
  }
  const said = isApiError(error) && !error.foreign ? serverWords(error.message, 160) : '';
  return said
    ? `The product was added, but it could not be marked as sold by weight: ${said}`
    : 'The product was added, but it could not be marked as sold by weight. It will sell by the unit until the owner changes it.';
}
