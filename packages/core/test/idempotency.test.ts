// Run from mobile/ with Node 22.18+, which runs .ts files directly (on 22.6-22.17 add
// --experimental-strip-types):
//   node --test packages/core/test/idempotency.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveIdempotencyKey } from '../src/idempotency.ts';

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
