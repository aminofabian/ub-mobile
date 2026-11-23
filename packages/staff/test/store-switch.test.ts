import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshPhone, installFetch } from '../../core/test/support/world.mjs';
import { __answerWith, __asked } from '../../core/test/support/fakes/react-native.mjs';
import { configureStorage } from '../../core/src/storage';
import { ACME, API, mobileBody, mobileUrl } from '../../core/test/fixtures';
import { getAccessToken, getActiveTenantId, openStore } from '@kiosk/core';
import { storeTokens } from '@kiosk/core';
import { outboxFor } from '@kiosk/offline';
import { confirmLeavingUnsent, confirmSignOut, confirmSigningOutWithUnsent, describeUnsent, leaveStore } from '../src/lib/store-switch';

let net: { restore(): void } | null = null;

beforeEach(async () => {
  freshPhone({});
  configureStorage(null);
  net = installFetch([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }]]) as { restore(): void };
  const opened = await openStore('acme', API, { audience: 'staff' });
  assert.equal(opened.kind, 'opened');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
});

afterEach(() => {
  net?.restore();
  net = null;
});

/** Queues real sales for the open shop through the real outbox, so the question is asked off the real queue. */
async function queueSales(count: number, stuck = 0) {
  const box = outboxFor(ACME.tenantId);
  for (let i = 0; i < count; i++) {
    await box.enqueue({ id: `s${i}`, method: 'POST', path: '/api/v1/sales', body: {}, idempotencyKey: `k${i}`, tenantId: ACME.tenantId });
  }
  for (let i = 0; i < stuck; i++) {
    await box.update(`s${i}`, { retries: 3 });
  }
}

test('leaving a shop with nothing unsent just leaves, without asking anything', async () => {
  assert.equal(await leaveStore('Acme Mart'), true);
  assert.equal(__asked.length, 0);
  assert.equal(await getActiveTenantId(), null);
  assert.equal(await getAccessToken(ACME.tenantId), null, 'nothing waits to be sent, so the sign-in ends with the visit');
});

test('with unsent sales the person is asked first, and cancelling leaves everything as it was', async () => {
  await queueSales(2);
  __answerWith(() => 'Cancel');

  assert.equal(await leaveStore('Acme Mart'), false);
  assert.equal(__asked.length, 1);
  assert.match(__asked[0].message, /Acme Mart has 2 unsent sales/);
  assert.deepEqual(__asked[0].buttons, ['Cancel', 'Switch anyway']);
  assert.equal(await getActiveTenantId(), ACME.tenantId, 'still in the shop');
  assert.equal(await getAccessToken(), 'A-access', 'and still signed in');
});

test('"Switch anyway" leaves, and the sales and the sign-in wait for the next visit', async () => {
  await queueSales(2);
  __answerWith(() => 'Switch anyway');

  assert.equal(await leaveStore('Acme Mart'), true);
  assert.equal(await getActiveTenantId(), null);
  assert.equal((await outboxFor(ACME.tenantId).pending()).length, 2, 'the sales are still queued');
  assert.equal(await getAccessToken(ACME.tenantId), 'A-access', 'with the sign-in they need to be sent');

  const again = await openStore('acme', API, { audience: 'staff' });
  assert.equal(again.kind, 'opened');
  assert.equal(await getAccessToken(), 'A-access', 'coming back finds the same session');
});

test('backing out of the question counts as cancelling', async () => {
  await queueSales(1);
  __answerWith(() => 'dismiss');
  assert.equal(await leaveStore('Acme Mart'), false);
  assert.equal(await getActiveTenantId(), ACME.tenantId);
});

test('the question names the shop, says how many need attention, and copes with a shop that has no name', async () => {
  await queueSales(3, 1);
  __answerWith(() => 'Cancel');
  await leaveStore('Acme Mart');
  assert.match(__asked[0].message, /Acme Mart has 3 unsent sales \(1 needs attention\)/);

  await leaveStore('   ');
  assert.match(__asked[1].message, /^This store has 3 unsent sales/);
  assert.match(__asked[1].message, /sign in to it\. Switch anyway\?$/);
  assert.match(__asked[0].message, /sign in to Acme Mart\. Switch anyway\?$/);
});

test('signing out with nothing unsent asks nothing', async () => {
  assert.equal(await confirmSignOut('Acme Mart'), true);
  assert.equal(__asked.length, 0);
});

test('signing out with unsent sales says who will send them, and only "Sign out anyway" goes ahead', async () => {
  await queueSales(2, 1);
  __answerWith(() => 'Stay signed in');
  assert.equal(await confirmSignOut('Acme Mart'), false);
  assert.equal(__asked.length, 1);
  assert.match(__asked[0].message, /^Acme Mart has 2 unsent sales \(1 needs attention\)\./);
  assert.match(__asked[0].message, /Whoever signs in next on this phone sends them, under their own name and shift\. Sign out anyway\?$/);
  assert.deepEqual(__asked[0].buttons, ['Stay signed in', 'Sign out anyway']);
  assert.equal(await getAccessToken(), 'A-access', 'asking changes nothing');

  __answerWith(() => 'Sign out anyway');
  assert.equal(await confirmSignOut('Acme Mart'), true);
  __answerWith(() => 'dismiss');
  assert.equal(await confirmSignOut('Acme Mart'), false, 'backing out is staying signed in');
});

test('the sign-out question copes with a shop that has no name, and counts one sale in the singular', async () => {
  __answerWith(() => 'Stay signed in');
  await confirmSigningOutWithUnsent({ total: 1, needsAttention: 0 }, '   ');
  assert.match(__asked[0].message, /^This store has 1 unsent sale\. Whoever signs in next/);
  await confirmSigningOutWithUnsent({ total: 3, needsAttention: 0 });
  assert.match(__asked[1].message, /^This store has 3 unsent sales\./);
});

test('describeUnsent counts in plain words', () => {
  assert.equal(describeUnsent({ total: 1, needsAttention: 0 }), '1 unsent sale');
  assert.equal(describeUnsent({ total: 4, needsAttention: 0 }), '4 unsent sales');
  assert.equal(describeUnsent({ total: 4, needsAttention: 1 }), '4 unsent sales (1 needs attention)');
  assert.equal(describeUnsent({ total: 4, needsAttention: 2 }), '4 unsent sales (2 need attention)');
});

test('confirmLeavingUnsent resolves true only for "Switch anyway"', async () => {
  __answerWith(() => 'Switch anyway');
  assert.equal(await confirmLeavingUnsent({ total: 1, needsAttention: 0 }, 'Acme Mart'), true);
  __answerWith(() => 'Cancel');
  assert.equal(await confirmLeavingUnsent({ total: 1, needsAttention: 0 }, 'Acme Mart'), false);
  __answerWith(() => 'dismiss');
  assert.equal(await confirmLeavingUnsent({ total: 1, needsAttention: 0 }, 'Acme Mart'), false);
});
