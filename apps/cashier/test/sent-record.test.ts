// Run from mobile/ like the other tests (see packages/offline/test/outbox.test.ts).
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshPhone, installFetch } from '../../../packages/core/test/support/world.mjs';
import { ACME, API, BOBS, PALMART, mobileBody, mobileUrl } from '../../../packages/core/test/fixtures';
import { configureStorage } from '../../../packages/core/src/storage';
import { createApiClient, openStore } from '@kiosk/core';
import { createSyncEngine, outbox } from '@kiosk/offline';
import { boundApi } from '../src/lib/bound-api';
import { factsFor } from '../src/lib/sale-facts';
import { readLog, recordSent } from '../src/lib/till-log';

type Handle = { calls: Array<{ url: string; method: string; body?: unknown }>; restore(): void };
let net: Handle | null = null;

beforeEach(() => {
  freshPhone({});
  configureStorage(null);
});

afterEach(() => {
  net?.restore();
  net = null;
});

const salesUrl = `${API}/api/v1/sales`;
const NOW = Date.parse('2026-11-23T12:00:00.000Z');

/** A sale as the Payment screen queues it: lines, an M-Pesa payment with a typed code, and what the till knows about it. */
function queuedSale(id: string) {
  const payments = [{ method: 'mpesa_manual', amount: 600, reference: 'SHK7Y2ABCD' }];
  return {
    id,
    method: 'POST',
    path: '/api/v1/sales',
    body: { lines: [{ quantity: 2, unitPrice: 300 }], payments },
    idempotencyKey: id,
    label: '2 x Bread',
    facts: factsFor({ person: { userId: 'u-1', name: 'Amina' }, payments, mpesaConfirmed: false, pricesAsOf: NOW - 3_600_000 }),
  };
}

test('what the till knows about a sale survives the queue, reaches the log when the sale is sent, and is never sent to the server', async () => {
  const sent: unknown[] = [];
  net = installFetch([
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }],
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
    [mobileUrl('palmart'), { status: 200, body: mobileBody(PALMART) }],
    [
      salesUrl,
      (_url: string, init: { body?: string }) => {
        sent.push(JSON.parse(String(init.body)));
        // The server priced it at 550, not the 600 the till asked for.
        return { status: 200, body: { id: 'sale-1', receiptNo: 17, grandTotal: 550 } };
      },
    ],
  ]) as Handle;
  assert.equal((await openStore('acme', API, { audience: 'staff', keepUnsent: false })).kind, 'opened');

  await outbox.enqueue(queuedSale('k-1'));
  const [kept] = await outbox.pending();
  assert.deepEqual(kept.facts, { rungBy: 'Amina', rungById: 'u-1', mpesaTyped: true, pricesAsOf: NOW - 3_600_000 });

  // Somebody else is signed in when the line comes back.
  const sender = { id: 'u-2', name: 'Brian' };
  const engine = createSyncEngine({
    api: boundApi(createApiClient({ baseURL: API }), 5_000, { lost: () => undefined }),
    onSynced: (item, response) => {
      void recordSent(ACME.tenantId, item, response, sender, NOW);
    },
  });
  await engine.sync();
  await new Promise<void>((resolve) => setTimeout(resolve, 20));

  assert.equal(sent.length, 1);
  assert.doesNotMatch(JSON.stringify(sent[0]), /rungBy|mpesaTyped|pricesAsOf|Amina/, 'the server is told only what a sale is');
  assert.deepEqual(await outbox.pending(), []);

  const log = await readLog(ACME.tenantId, NOW);
  assert.deepEqual(log.map((entry) => entry.kind).sort(), ['priced_differently', 'sent_by_other', 'typed_code']);
  const byKind = Object.fromEntries(log.map((entry) => [entry.kind, entry.text]));
  assert.match(byKind.typed_code, /^Sale #17: The sale of 600\.00 rung .* by Amina was paid 600\.00 by M-Pesa with a code that was typed in \(\.\.\.ABCD\)/);
  assert.match(byKind.priced_differently, /was priced 550\.00 by the server, not 600\.00.*50\.00 is owed back to the customer/);
  assert.match(byKind.sent_by_other, /was sent while Brian was signed in/);
});

test('a sale sent by the person who rang it, at the price the till asked, writes nothing down unless its code was typed', async () => {
  net = installFetch([
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }],
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
    [mobileUrl('palmart'), { status: 200, body: mobileBody(PALMART) }],
    [salesUrl, { status: 200, body: { id: 'sale-2', receiptNo: 18, grandTotal: 600 } }],
  ]) as Handle;
  assert.equal((await openStore('acme', API, { audience: 'staff', keepUnsent: false })).kind, 'opened');
  const confirmed = { ...queuedSale('k-2'), facts: factsFor({ person: { userId: 'u-1', name: 'Amina' }, payments: [{ method: 'mpesa_manual' }], mpesaConfirmed: true, pricesAsOf: null }) };
  await outbox.enqueue(confirmed);
  const engine = createSyncEngine({
    api: boundApi(createApiClient({ baseURL: API }), 5_000, { lost: () => undefined }),
    onSynced: (item, response) => {
      void recordSent(ACME.tenantId, item, response, { id: 'u-1', name: 'Amina' }, NOW);
    },
  });
  await engine.sync();
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(await readLog(ACME.tenantId, NOW), []);
});
