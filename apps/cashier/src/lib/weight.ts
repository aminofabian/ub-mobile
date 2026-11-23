import { lineCents } from './money';

/**
 * Selling by weight. The server takes a weighed item in kilograms only, to at most three decimals (grams), above
 * zero. A weighed item priced per gram or per pound, or sold as a pack, is turned away at the server, so the till
 * says so before the sale rather than after the customer has paid.
 */

/** The most one line may weigh: 999.999 kg. A slipped finger ("12500" for "1.25"), not a sale. */
export const MAX_WEIGHT_THOUSANDTHS = 999_999;

export type WeightProblem = 'empty' | 'not_a_number' | 'too_many_decimals' | 'zero' | 'too_heavy';

export type WeightEntry = { ok: true; thousandths: number } | { ok: false; problem: WeightProblem };

// Digits, optionally followed by a point and more digits. A comma is not a decimal mark here: the till reads
// money the same strict way, and "1,250" must never be read as 1.25 or as 1250.
const WEIGHT_TEXT = /^(\d*)(?:\.(\d*))?$/;

/**
 * What a person typed into a weight box, in thousandths of a kilogram (grams), or why it is not a weight.
 * "1.25", "1.", ".5" and "2" are weights; "1,25", "1.2345", "0", "-1", "1e3" and "" are not.
 */
export function parseWeightKg(text: string): WeightEntry {
  const typed = text.trim();
  if (!typed) return { ok: false, problem: 'empty' };
  const match = WEIGHT_TEXT.exec(typed);
  if (!match) return { ok: false, problem: 'not_a_number' };
  const whole = match[1] ?? '';
  const fraction = match[2] ?? '';
  if (!whole && !fraction) return { ok: false, problem: 'not_a_number' };
  // Zeros after the third decimal say nothing more: "1.2500" is 1.25. Any other digit there is a weight the server refuses.
  const significant = fraction.replace(/0+$/, '');
  if (significant.length > 3) return { ok: false, problem: 'too_many_decimals' };
  const thousandths = Number(whole || '0') * 1000 + Number(significant.padEnd(3, '0'));
  if (thousandths === 0) return { ok: false, problem: 'zero' };
  if (thousandths > MAX_WEIGHT_THOUSANDTHS) return { ok: false, problem: 'too_heavy' };
  return { ok: true, thousandths };
}

/** What to tell the cashier about a weight that cannot be used. */
export function weightProblemWords(problem: WeightProblem): string {
  switch (problem) {
    case 'empty':
      return 'Enter the weight in kg.';
    case 'not_a_number':
      return 'Use digits and a point, like 1.25.';
    case 'too_many_decimals':
      return 'Three decimals at most (grams), like 0.125.';
    case 'zero':
      return 'The weight must be above zero.';
    case 'too_heavy':
      return 'That is over 999.999 kg. Check the weight.';
  }
}

/** A stored weight (thousandths of a kilogram) as the number of kilograms the server is sent. Exact to three decimals. */
export function thousandthsToKg(thousandths: number): number {
  return Math.round(thousandths) / 1000;
}

/** Kilograms as a basket line holds them, in thousandths. Null for anything that is not a usable weight. */
export function kgToThousandths(kg: number): number | null {
  if (!Number.isFinite(kg)) return null;
  const thousandths = Math.round(kg * 1000);
  return thousandths > 0 && thousandths <= MAX_WEIGHT_THOUSANDTHS ? thousandths : null;
}

/** 1250 -> "1.25 kg", 2000 -> "2 kg", 125 -> "0.125 kg". */
export function formatKg(thousandths: number): string {
  const rounded = Math.max(0, Math.round(thousandths));
  const whole = Math.floor(rounded / 1000);
  const fraction = rounded % 1000;
  const decimals = fraction === 0 ? '' : `.${String(fraction).padStart(3, '0').replace(/0+$/, '')}`;
  return `${whole}${decimals} kg`;
}

/** The parts of an item that decide how it can be sold. */
export interface Sellable {
  weighed?: boolean;
  unitType?: string;
  /** Sold as a pack whose stock is held on another item. */
  packageVariant?: boolean;
}

export type SaleMode =
  /** Whole units, one tap each. */
  | { kind: 'units' }
  /** By weight, in kilograms. */
  | { kind: 'kg' }
  /** The server would refuse it: `why` is for the cashier. */
  | { kind: 'blocked'; why: string };

/** How the server lets this item be sold. */
export function howToSell(item: Sellable): SaleMode {
  if (item.weighed !== true) return { kind: 'units' };
  if (item.packageVariant === true) {
    return { kind: 'blocked', why: 'This item is sold as a pack, not by weight. Ask the owner to fix it in the catalogue.' };
  }
  const unit = (item.unitType ?? '').trim().toLowerCase();
  if (unit === 'kg') return { kind: 'kg' };
  if (unit === 'g' || unit === 'lb') {
    return {
      kind: 'blocked',
      why: `This item is priced per ${unit}, and the till sells by weight in kg only. Ask the owner to change it to kg.`,
    };
  }
  return { kind: 'blocked', why: 'This item is marked as weighed but has no weight unit. Ask the owner to set it to kg.' };
}

export type WeighedPreview =
  | { ok: true; thousandths: number; weight: string; totalCents: number }
  | { ok: false; words: string };

/** What the weight prompt shows for what has been typed so far: the line total, or what is wrong with it. */
export function previewWeighedLine(unitPrice: number, text: string): WeighedPreview {
  const entry = parseWeightKg(text);
  if (!entry.ok) return { ok: false, words: weightProblemWords(entry.problem) };
  const totalCents = lineCents(thousandthsToKg(entry.thousandths), unitPrice);
  if (totalCents === null) return { ok: false, words: 'This item has no usable price.' };
  return { ok: true, thousandths: entry.thousandths, weight: formatKg(entry.thousandths), totalCents };
}
