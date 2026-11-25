/**
 * A small ESC/POS command builder for thermal receipt printers.
 *
 * ESC/POS is the near-universal language of cheap thermal printers: a stream of plain bytes with a
 * few control sequences (ESC = 0x1B, GS = 0x1D) for alignment, bold, size, cut and the like. This
 * builder collects those bytes; the transport (BLE, or the on-screen mock) just writes them out.
 *
 * The till talks to 58mm and 80mm printers — 32 and 48 characters per line in the normal font. We
 * keep to the plain Latin font and ASCII-ish text so any printer renders it; callers pass the
 * column width so the same receipt lays out on either paper.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type Align = 'left' | 'center' | 'right';

/** Characters per line for the normal font: 58mm paper fits 32, 80mm fits 48. */
export const PAPER_COLUMNS = { '58': 32, '80': 48 } as const;
export type PaperWidth = keyof typeof PAPER_COLUMNS;

/**
 * Accumulates ESC/POS bytes. Chainable: `new EscPosBuilder(32).center().bold(true).text('KIOSK')…`.
 * `build()` returns the finished byte array for the transport to send.
 */
export class EscPosBuilder {
  private bytes: number[] = [];
  readonly columns: number;

  constructor(columns = 32) {
    this.columns = columns;
    // Initialise the printer: clears any leftover mode from the last job.
    this.raw(ESC, 0x40); // ESC @
  }

  /** Append raw bytes. */
  raw(...b: number[]): this {
    for (const x of b) this.bytes.push(x & 0xff);
    return this;
  }

  /** Encode a string as Latin-1-ish bytes (one byte per char), replacing anything out of range. */
  private encode(s: string): number[] {
    const out: number[] = [];
    for (const ch of s) {
      const code = ch.codePointAt(0) ?? 0x3f;
      out.push(code <= 0xff ? code : 0x3f /* '?' */);
    }
    return out;
  }

  align(a: Align): this {
    const n = a === 'center' ? 1 : a === 'right' ? 2 : 0;
    return this.raw(ESC, 0x61, n); // ESC a n
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0); // ESC E n
  }

  /** Double width/height. `size(2,2)` is the big shop-name line; `size(1,1)` is normal. */
  size(width: 1 | 2, height: 1 | 2): this {
    const n = ((width - 1) << 4) | (height - 1);
    return this.raw(GS, 0x21, n); // GS ! n
  }

  underline(on: boolean): this {
    return this.raw(ESC, 0x2d, on ? 1 : 0); // ESC - n
  }

  /** Write text, no newline. */
  text(s: string): this {
    return this.raw(...this.encode(s));
  }

  /** Write text then a line feed. */
  line(s = ''): this {
    return this.text(s).raw(LF);
  }

  /** Blank lines. */
  feed(n = 1): this {
    for (let i = 0; i < n; i++) this.raw(LF);
    return this;
  }

  /** A full-width rule of one character, e.g. '-' or '='. */
  rule(ch = '-'): this {
    return this.line(ch.repeat(this.columns));
  }

  /**
   * A left label and a right value on one line, padded to the column width — the shape every money
   * row on a receipt takes ("Subtotal" … "1,860.00"). When the two together overflow the width, the
   * label is cut so the value is never lost.
   */
  columns2(left: string, right: string): this {
    const width = this.columns;
    if (right.length >= width) return this.line(right.slice(0, width));
    const room = width - right.length;
    const label = left.length > room - 1 ? left.slice(0, Math.max(0, room - 2)) + '…' : left;
    const pad = Math.max(1, width - label.length - right.length);
    return this.line(label + ' '.repeat(pad) + right);
  }

  /**
   * An item row: name on the left wrapping across lines, and `qty x price` + line total laid out
   * under it, so a long product name never pushes the money off the paper.
   */
  item(name: string, qtyPrice: string, total: string): this {
    // Wrap the name to the full width.
    for (const row of wrap(name, this.columns)) this.line(row);
    return this.columns2('  ' + qtyPrice, total);
  }

  /** Feed and cut the paper. Harmless on printers without a cutter (they just feed). */
  cut(): this {
    return this.feed(3).raw(GS, 0x56, 0x42, 0x00); // GS V 66 0 (partial cut, feed)
  }

  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  /**
   * The bytes as the plain text they would print — for the on-screen preview. Control sequences are
   * stepped over by their exact length (the ones this builder emits), so a parameter byte that
   * happens to be printable never leaks into the text.
   */
  preview(): string {
    const by = this.bytes;
    let out = '';
    for (let i = 0; i < by.length; i++) {
      const b = by[i];
      if (b === LF) {
        out += '\n';
      } else if (b === ESC) {
        // ESC @ (1 param-less) ; ESC a/E/-/! (1 param each): all two more bytes but '@' has none.
        i += by[i + 1] === 0x40 ? 1 : 2;
      } else if (b === GS) {
        // GS ! n → 3 bytes total ; GS V m n → 4 bytes total.
        i += by[i + 1] === 0x56 ? 3 : 2;
      } else if (b >= 0x20 && b <= 0xff) {
        out += String.fromCharCode(b);
      }
    }
    return out;
  }
}

/** Break a string into lines no wider than `width`, splitting on spaces where it can. */
export function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > width) {
      // A single word longer than the line: hard-split it.
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
