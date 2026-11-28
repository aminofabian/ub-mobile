/**
 * Random secrets, from the phone's secure random source when it has one.
 *
 * The password a shopper never sees (the join makes one for the account, and the app keeps it to sign in
 * again) used to be drawn with `Math.random`, which is not made for secrets. This draws from
 * `crypto.getRandomValues` when the runtime has it, and says so when it did not, so a caller can tell. A
 * source that is certain to exist on the phone needs the `expo-crypto` package, which is not installed and
 * is the owner's to approve; until then a phone without the secure source gets the old kind of draw.
 *
 * No imports, so node can run this file's test directly.
 */
export type RandomBytes = (bytes: Uint8Array) => void;

/** Letters and digits without the ones that look alike, so a secret can be read out if it ever has to be. */
export const SECRET_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** The runtime's secure random source, or null when it has none. */
export function secureRandomSource(): RandomBytes | null {
  const crypto = (globalThis as { crypto?: { getRandomValues?: (bytes: Uint8Array) => unknown } }).crypto;
  const get = crypto?.getRandomValues;
  return typeof get === 'function' ? (bytes) => void get.call(crypto, bytes) : null;
}

export interface Secret {
  value: string;
  /** Drawn from a secure source. False means the fallback was used. */
  secure: boolean;
}

/**
 * `length` characters from `alphabet`. Bytes that would favour the first characters of the alphabet (the
 * top of the range that does not divide evenly) are thrown away, so every character is equally likely.
 */
export function randomSecret(
  length: number,
  source: RandomBytes | null = secureRandomSource(),
  alphabet: string = SECRET_ALPHABET,
  fallback: () => number = Math.random,
): Secret {
  const n = alphabet.length;
  if (!Number.isInteger(length) || length < 1) throw new RangeError('length must be a positive whole number');
  if (n < 2 || n > 256) throw new RangeError('alphabet must have between 2 and 256 characters');

  let out = '';
  if (source) {
    const limit = 256 - (256 % n);
    const bytes = new Uint8Array(Math.max(32, length * 2));
    // Terminates with probability one; the bound only guards a source that returns the same byte for ever.
    for (let round = 0; out.length < length && round < 1000; round += 1) {
      source(bytes);
      for (let i = 0; i < bytes.length && out.length < length; i += 1) {
        if (bytes[i] < limit) out += alphabet[bytes[i] % n];
      }
    }
    if (out.length === length) return { value: out, secure: true };
    out = '';
  }
  for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(fallback() * n)];
  return { value: out, secure: false };
}
