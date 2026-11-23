import { cleanDisplayText } from '@kiosk/core';

/**
 * What the till calls a product. The server keeps a name on every row, but a size or pack of a product ("500ml",
 * "pack of 12") may be only in its option label, a row that came from an import may have no real name at all, and
 * two sizes of one product that are shown by the same words are two different things for a cashier to mix up. So the
 * label is the name, plus the option when the name does not already say it, and falls back to what the row does
 * say when the name is no use. The rules follow the web till's, in the cases that matter for picking the right row.
 */

export interface LabelRow {
  name?: unknown;
  variantName?: unknown;
  /** The product this row is a size or option of, as it is named now. */
  parentName?: unknown;
  variantOfItemId?: unknown;
  brand?: unknown;
  size?: unknown;
}

const MAX_LABEL_CHARACTERS = 120;
const UUID = /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/i;
const IMPORT_PLACEHOLDER = /^IMP-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** What an import writes when a row has no real option label. */
const GENERIC_OPTIONS = new Set(['variant', 'option', 'variation', 'default']);

function clean(value: unknown): string {
  return cleanDisplayText(value, MAX_LABEL_CHARACTERS);
}

/** A name that says what the product is: not blank, not an id, not an import's placeholder, not a bare code. */
function realName(value: unknown): string {
  const text = clean(value);
  if (!text || UUID.test(text) || IMPORT_PLACEHOLDER.test(text)) return '';
  return text;
}

/** A bare number is a code that leaked into the name: shown only when the row says nothing better. */
function isCode(text: string): boolean {
  return /^\d+$/.test(text);
}

function realOption(value: unknown): string {
  const text = clean(value);
  if (!text || UUID.test(text) || GENERIC_OPTIONS.has(text.toLowerCase())) return '';
  return text;
}

function startsWithWords(text: string, prefix: string): boolean {
  return text.toLowerCase().startsWith(prefix.toLowerCase());
}

const SEPARATORS = /^[\s·•\-–,]+/;

/**
 * "Coca Cola 500ml" with the family "Coca Cola" is "500ml": the option without the family said again. Whole words
 * only ("Milk" does not start "Milkshake"), and an option that is only the family is nothing more to say.
 */
function withoutFamily(option: string, family: string): string {
  if (!family || !startsWithWords(option, family)) return option;
  const after = option.slice(family.length);
  if (after !== '' && !SEPARATORS.test(after)) return option;
  return after.replace(SEPARATORS, '').trim();
}

function contains(text: string, part: string): boolean {
  return text.toLowerCase().includes(part.toLowerCase());
}

/** The words to show for a product at the till. Never empty. */
export function itemLabel(row: LabelRow): string {
  const isVariant = typeof row.variantOfItemId === 'string' && row.variantOfItemId.trim() !== '';
  const own = realName(row.name);
  const option = realOption(row.variantName) || realOption(row.size);

  // The product as it is named now (a size of a product follows the product's name, so a rename shows), and when
  // there is no name or only a code, the brand if the row has one.
  let family = (isVariant ? realName(row.parentName) : '') || own;
  if (family === '' || isCode(family)) family = realName(row.brand) || family;
  if (!family) return option || 'Item';
  if (!option) {
    // A size of a product with no option label still says its size in its own name: that name, not the family's.
    return isVariant && own && !isCode(own) ? own : family;
  }

  const rest = withoutFamily(option, family);
  return contains(family, rest) ? family : `${family} · ${rest}`;
}
