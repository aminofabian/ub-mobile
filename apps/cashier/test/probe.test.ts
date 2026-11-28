import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { lookAtShop, probeShop } from '../src/lib/probe';

const apiOf = (answer: () => Promise<unknown>) => ({ get: async () => answer() }) as never;

test('a shop that answers gives back its settings', async () => {
  const flags = await probeShop(apiOf(async () => ({ featureFlags: { 'pos.cashier_price_edit': true } })));
  assert.deepEqual(flags, { 'pos.cashier_price_edit': true });
});

test('a shop that answers with nothing useful is still an answer', async () => {
  assert.deepEqual(await probeShop(apiOf(async () => ({}))), {});
});

test('a failure, a "no" and a silence are all null, and none throws', async () => {
  assert.equal(await probeShop(apiOf(async () => { throw new TypeError('Network request failed'); })), null);
  assert.equal(await probeShop(apiOf(async () => { throw new ApiError('x', { status: 403 }); })), null);
  assert.equal(await probeShop(apiOf(() => new Promise(() => undefined)), 5), null);
});

test('looking at the shop hands what it says to whoever wants it, and says whether it answered', async () => {
  const learned: unknown[] = [];
  assert.equal(
    await lookAtShop(apiOf(async () => ({ featureFlags: { 'pos.cashier_price_edit': true } })), (flags) => learned.push(flags)),
    true
  );
  assert.deepEqual(learned, [{ 'pos.cashier_price_edit': true }]);
});

test('looking at a shop that does not answer says so, and hands nothing on', async () => {
  const learned: unknown[] = [];
  assert.equal(await lookAtShop(apiOf(async () => { throw new TypeError('Network request failed'); }), (flags) => learned.push(flags)), false);
  assert.equal(await lookAtShop(apiOf(() => new Promise(() => undefined)), (flags) => learned.push(flags), 5), false);
  assert.deepEqual(learned, []);
});
