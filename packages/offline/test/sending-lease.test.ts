import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SENDING_LEASE_MS, holdWhileSending, isBeingSent } from '../src/outbox';

test('a request held while it is sent is being sent until it is released', () => {
  assert.equal(isBeingSent('k1'), false);
  const release = holdWhileSending('k1');
  assert.equal(isBeingSent('k1'), true);
  assert.equal(isBeingSent('k2'), false, 'another request is not held');
  release();
  assert.equal(isBeingSent('k1'), false);
  release(); // releasing twice is harmless
});

test('a hold that is never released ends by itself, so a request that hangs cannot park a sale for good', () => {
  let clock = 1_000;
  const now = () => clock;
  holdWhileSending('k3', now);
  clock += SENDING_LEASE_MS - 1;
  assert.equal(isBeingSent('k3', now), true);
  clock += 1;
  assert.equal(isBeingSent('k3', now), false);
});

test('an old release does not end a newer hold on the same request', () => {
  let clock = 5_000;
  const now = () => clock;
  const first = holdWhileSending('k4', now);
  clock += 10;
  const second = holdWhileSending('k4', now);
  first();
  assert.equal(isBeingSent('k4', now), true);
  second();
  assert.equal(isBeingSent('k4', now), false);
});
