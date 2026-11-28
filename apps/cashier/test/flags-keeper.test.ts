import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore } from '../../../packages/core/test/support/world.mjs';
import { keepFlags, readStoredFlags } from '../src/lib/flags-keeper';
import { FLAG, STORED_FLAGS_LIFETIME_MS } from '../src/lib/shop-flags';

const NOON = Date.parse('2026-11-23T12:00:00.000Z');

test('what the shop said is kept for that shop and comes back', async () => {
  await keepFlags('shop-f1', { [FLAG.priceEdit]: true }, NOON);
  assert.deepEqual(await readStoredFlags('shop-f1', NOON + 1_000), { [FLAG.priceEdit]: true });
});

test('another shop has its own, and a shop that never said has none', async () => {
  await keepFlags('shop-f2', { [FLAG.createProduct]: true }, NOON);
  assert.equal(await readStoredFlags('shop-f3', NOON), null);
  assert.deepEqual(await readStoredFlags('shop-f2', NOON), { [FLAG.createProduct]: true });
});

test('a week later they are not believed', async () => {
  await keepFlags('shop-f4', { [FLAG.priceEdit]: true }, NOON);
  assert.equal(await readStoredFlags('shop-f4', NOON + STORED_FLAGS_LIFETIME_MS + 1), null);
});

test('the newest answer replaces the one before', async () => {
  await keepFlags('shop-f5', { [FLAG.priceEdit]: true }, NOON);
  await keepFlags('shop-f5', { [FLAG.priceEdit]: false }, NOON + 5_000);
  assert.deepEqual(await readStoredFlags('shop-f5', NOON + 6_000), { [FLAG.priceEdit]: false });
});

test('an id that is not a shop is never an error', async () => {
  await keepFlags('', { a: true }, NOON);
  assert.equal(await readStoredFlags('', NOON), null);
});

test('a phone whose storage fails is never an error: nothing is believed, and nothing is kept', async () => {
  await keepFlags('shop-f6', { [FLAG.priceEdit]: true }, NOON);
  asyncStore.__setFault(() => {
    throw new Error('storage is full');
  });
  try {
    assert.equal(await readStoredFlags('shop-f6', NOON), null, 'reading fails quietly');
    await keepFlags('shop-f6', { [FLAG.priceEdit]: false }, NOON + 1_000);
  } finally {
    asyncStore.__setFault(null);
  }
  assert.deepEqual(await readStoredFlags('shop-f6', NOON + 2_000), { [FLAG.priceEdit]: true }, 'what was kept before is still there');
});
