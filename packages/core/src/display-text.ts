/**
 * A name a shop chose for itself is shown inside the app's own sentences, such as "Open Acme Mart?", so it
 * is cleaned of what lets it read as something else: line breaks and other control characters, and the
 * invisible marks that hide or reorder text (the zero-width space, the left-to-right and right-to-left
 * marks, the embedding, override and isolate controls, the soft hyphen), of the tag characters and the
 * variation selectors that can carry hidden text, and of the filler characters that draw nothing and let a
 * name read as blank. Runs of spaces become one, the ends are trimmed, and the length is capped by characters,
 * not by UTF-16 units, so an emoji is never cut in half.
 *
 * The zero-width joiner and non-joiner stay: emoji sequences and Persian, Urdu and Indic words need them. So
 * do the two variation selectors that choose between text and emoji style (U+FE0E and U+FE0F). The marks are
 * listed as explicit ranges, not matched with a Unicode property, and the ones outside the first plane as
 * surrogate pairs, so the result is the same on every JavaScript engine the app runs on.
 */

const INVISIBLE = new RegExp(
  [
    '[\\u0000-\\u001F\\u007F-\\u009F\\u00AD\\u061C\\u180E\\u200B\\u200E\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFFF9-\\uFFFB',
    // Fillers: Hangul, Khmer inherent vowels and the blank braille pattern.
    '\\u115F\\u1160\\u17B4\\u17B5\\u2800\\u3164\\uFFA0',
    // Variation selectors 1 to 14 (not 15 and 16, which choose text or emoji style).
    '\\uFE00-\\uFE0D]',
    // Tag characters (U+E0000 to U+E007F) and the variation selectors supplement (U+E0100 to U+E01EF).
    '|\\uDB40[\\uDC00-\\uDC7F\\uDD00-\\uDDEF]',
  ].join(''),
  'g'
);

export const MAX_DISPLAY_NAME_LENGTH = 80;

// Letters, digits and hyphens in labels of at most 63 characters, at least two labels, an optional port.
const HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?::\d{1,5})?$/;

/**
 * A shop's web address as a plain, lower-case host (with an optional port), or null when it is anything
 * else. The address comes from the server and is put inside sentences and links, so only a plain one is used.
 */
export function plainHost(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const clean = raw.trim().toLowerCase();
  return clean.length > 0 && clean.length <= 253 && HOST_RE.test(clean) ? clean : null;
}

/** The cleaned text, or an empty string when there is nothing left to show. */
export function cleanDisplayText(raw: unknown, max = MAX_DISPLAY_NAME_LENGTH): string {
  if (typeof raw !== 'string') {
    return '';
  }
  const spaced = raw.replace(/\s+/g, ' ').replace(INVISIBLE, '').replace(/ {2,}/g, ' ').trim();
  return Array.from(spaced).slice(0, max).join('').trim();
}
