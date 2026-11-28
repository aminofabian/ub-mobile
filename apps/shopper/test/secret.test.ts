import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomSecret, SECRET_ALPHABET, secureRandomSource, type RandomBytes } from '../src/lib/secret';

/** A source that hands out the given bytes in order, then starts again. */
function fixed(...values: number[]): RandomBytes {
  let at = 0;
  return (bytes) => {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = values[at++ % values.length];
  };
}

test('a secret has the length asked for and only the characters of the alphabet', () => {
  const secret = randomSecret(24);
  assert.equal(secret.value.length, 24);
  for (const ch of secret.value) assert.ok(SECRET_ALPHABET.includes(ch), ch);
});

test('the alphabet leaves out the characters that look alike', () => {
  for (const ch of ['l', 'I', 'O', '0', '1']) assert.ok(!SECRET_ALPHABET.includes(ch), ch);
});

test('bytes are mapped to characters in order, from the secure source', () => {
  const secret = randomSecret(4, fixed(0, 1, 2, 55), SECRET_ALPHABET);
  assert.deepEqual(secret, { value: `${SECRET_ALPHABET[0]}${SECRET_ALPHABET[1]}${SECRET_ALPHABET[2]}${SECRET_ALPHABET[55]}`, secure: true });
});

test('bytes from the top of the range, which would favour the first characters, are not used', () => {
  const n = SECRET_ALPHABET.length;
  const limit = 256 - (256 % n);
  // 255 and the bytes from `limit` up are thrown away; the byte after them is the first one used.
  const secret = randomSecret(1, fixed(255, limit, limit + 1, 3), SECRET_ALPHABET);
  assert.equal(secret.value, SECRET_ALPHABET[3]);
  assert.equal(secret.secure, true);
});

test('every character is equally likely over every byte that is allowed', () => {
  const n = SECRET_ALPHABET.length;
  const limit = 256 - (256 % n);
  const counts = new Map<string, number>();
  const all = Array.from({ length: limit }, (_, i) => i);
  const secret = randomSecret(limit, fixed(...all), SECRET_ALPHABET);
  for (const ch of secret.value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  assert.equal(counts.size, n);
  assert.deepEqual(new Set(counts.values()), new Set([limit / n]));
});

test('a source that never gives a usable byte is given up on, and the fallback is marked as not secure', () => {
  const secret = randomSecret(8, fixed(255), SECRET_ALPHABET, () => 0.5);
  assert.equal(secret.secure, false);
  assert.equal(secret.value, SECRET_ALPHABET[Math.floor(0.5 * SECRET_ALPHABET.length)].repeat(8));
});

test('with no secure source the fallback is used and says so', () => {
  const secret = randomSecret(10, null, SECRET_ALPHABET, () => 0);
  assert.deepEqual(secret, { value: SECRET_ALPHABET[0].repeat(10), secure: false });
});

test('two secrets from the real source differ, and are marked secure when this runtime has one', () => {
  const a = randomSecret(24);
  const b = randomSecret(24);
  assert.notEqual(a.value, b.value);
  assert.equal(a.secure, secureRandomSource() !== null);
});

test('a runtime with no secure source is told so, and one with it is called the way it needs', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const set = (value: unknown) => Object.defineProperty(globalThis, 'crypto', { value, configurable: true, writable: true });
  try {
    set(undefined);
    assert.equal(secureRandomSource(), null);
    set({});
    assert.equal(secureRandomSource(), null, 'a crypto object with nothing to draw from');
    let owner: unknown = null;
    const fake = {
      getRandomValues(this: unknown, bytes: Uint8Array) {
        owner = this;
        bytes.fill(7);
      },
    };
    set(fake);
    const source = secureRandomSource();
    assert.ok(source);
    source?.(new Uint8Array(4));
    assert.equal(owner, fake, 'called on the crypto object, as the real one insists');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete (globalThis as { crypto?: unknown }).crypto;
  }
});

test('a length or an alphabet that makes no sense is refused', () => {
  assert.throws(() => randomSecret(0), RangeError);
  assert.throws(() => randomSecret(-1), RangeError);
  assert.throws(() => randomSecret(1.5), RangeError);
  assert.throws(() => randomSecret(4, null, 'a'), RangeError);
  assert.throws(() => randomSecret(4, null, 'x'.repeat(257)), RangeError);
});
