import { tenantHostSuffix } from './mobile-config';

/**
 * Shop codes (plan §5.3, §5.10 row 3): five or six characters printed on receipts, shelf tags and
 * posters, typed or scanned. The alphabet leaves out the characters people mix up (0 O 1 I L), so
 * what is printed can be read back without guessing.
 *
 * The server owns the format, including a check character. The app only tidies what was typed and
 * refuses what can never be a code; whether a code belongs to a shop is the server's answer.
 */

/** A to Z without I, L and O, then 2 to 9: 31 characters. */
export const SHOP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SHOP_CODE_MIN_LENGTH = 5;
export const SHOP_CODE_MAX_LENGTH = 6;

export type ShopCodeParse =
  | { kind: 'ok'; code: string }
  /** Fewer than five characters so far: say nothing, the person is still typing. */
  | { kind: 'incomplete' }
  | { kind: 'too_long' }
  | { kind: 'invalid_characters'; characters: string[] };

/** What was typed, as a code. Case, spaces, dots, dashes and underscores do not matter. */
export function parseShopCode(input: string): ShopCodeParse {
  const code = input.toUpperCase().replace(/[\s._-]/g, '');
  const invalid = [...new Set([...code].filter((character) => !SHOP_CODE_ALPHABET.includes(character)))];
  if (invalid.length > 0) {
    return { kind: 'invalid_characters', characters: invalid };
  }
  if (code.length < SHOP_CODE_MIN_LENGTH) {
    return { kind: 'incomplete' };
  }
  return code.length > SHOP_CODE_MAX_LENGTH ? { kind: 'too_long' } : { kind: 'ok', code };
}

const CONFUSED = new Set(['0', 'O', '1', 'I', 'L']);

/** The sentence to show beside the field, or null when there is nothing to say yet. */
export function describeShopCodeProblem(parse: ShopCodeParse): string | null {
  switch (parse.kind) {
    case 'ok':
    case 'incomplete':
      return null;
    case 'too_long':
      return `Shop codes have at most ${SHOP_CODE_MAX_LENGTH} characters.`;
    case 'invalid_characters':
      return parse.characters.every((character) => CONFUSED.has(character))
        ? 'Shop codes never use the letters I, L or O, or the digits 0 and 1.'
        : 'Shop codes use letters and numbers only.';
  }
}

const SHOP_CODE_LINK = /^(?:kiosk:\/\/c|https?:\/\/([^/?#]+)\/c)\/([^/?#]+)\/?(?:[?#].*)?$/i;

function onPlatformApex(host: string): boolean {
  const suffix = tenantHostSuffix().trim().toLowerCase().replace(/^\./, '');
  const bare = host.toLowerCase().replace(/:\d+$/, '');
  return bare === suffix || bare === `www.${suffix}`;
}

/**
 * The code in a link such as `https://kiosk.ke/c/K7M4Q` or `kiosk://c/K7M4Q`, or null for anything else.
 * Only the platform's own address counts: a code on someone else's site is not ours to open.
 */
export function parseShopCodeLink(url: string): string | null {
  const match = SHOP_CODE_LINK.exec(url.trim());
  if (!match) {
    return null;
  }
  const host = match[1];
  if (host !== undefined && !onPlatformApex(host)) {
    return null;
  }
  let candidate = match[2] ?? '';
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  const parse = parseShopCode(candidate);
  return parse.kind === 'ok' ? parse.code : null;
}
