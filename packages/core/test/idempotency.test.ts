// Run from mobile/ with Node 22.18+, which runs .ts files directly (on 22.6-22.17 add
// --experimental-strip-types):
//   node --test packages/core/test/idempotency.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateIdempotencyKey, resolveIdempotencyKey } from '../src/idempotency.ts';

test('an explicit key is sent exactly as given', () => {
  assert.equal(resolveIdempotencyKey({ idempotencyKey: 'sale-42' }), 'sale-42');
  assert.equal(resolveIdempotencyKey({ idempotent: true, idempotencyKey: 'sale-42' }), 'sale-42');
});

test('an idempotent call without a key gets a fresh key each time', () => {
  const first = resolveIdempotencyKey({ idempotent: true });
  const second = resolveIdempotencyKey({ idempotent: true });
  assert.ok(first && second);
  assert.notEqual(first, second);
});

test('a blank key counts as no key', () => {
  assert.equal(resolveIdempotencyKey({ idempotencyKey: '' }), undefined);
  const minted = resolveIdempotencyKey({ idempotent: true, idempotencyKey: '' });
  assert.ok(minted);
});

test('a call that is not idempotent carries no key', () => {
  assert.equal(resolveIdempotencyKey(), undefined);
  assert.equal(resolveIdempotencyKey({}), undefined);
  assert.equal(resolveIdempotencyKey({ idempotent: false }), undefined);
});

test('the random part of a key comes from the secure source when there is one, and from Math.random when there is not', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const mathRandom = Math.random;
  try {
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (bytes: Uint8Array) => bytes.fill(171) }, configurable: true, writable: true });
    assert.match(generateIdempotencyKey(), /^[0-9a-z]+-abababababababab$/);
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    Math.random = () => 0.5;
    assert.match(generateIdempotencyKey(), /^[0-9a-z]+-8080808080808080$/);
  } finally {
    Math.random = mathRandom;
    if (original) Object.defineProperty(globalThis, 'crypto', original);
    else Reflect.deleteProperty(globalThis, 'crypto');
  }
  assert.match(generateIdempotencyKey(), /^[0-9a-z]+-[0-9a-f]{16}$/, 'and the real source is back');
});
