// Run from mobile/ like the other tests (see packages/offline/test/outbox.test.ts).
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore, freshPhone, installFetch } from '../../../packages/core/test/support/world.mjs';
import { ACME, API, BOBS, PALMART, mobileBody, mobileUrl } from '../../../packages/core/test/fixtures';
import { configureStorage } from '../../../packages/core/src/storage';
import * as K from '../../../packages/core/src/storage-keys';
import { createApiClient, openStore } from '@kiosk/core';
import { createSyncEngine, isBeingSent, outbox } from '@kiosk/offline';
import { boundApi } from '../src/lib/bound-api';

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

/** A queued sale, as the Payment screen queues it: the item is known by the key it is sent under. */
const sale = (id: string) => ({ id, method: 'POST', path: '/api/v1/sales', body: { n: id }, idempotencyKey: id });

function queued(): Array<Record<string, unknown>> {
  const raw = asyncStore.__store.get(K.outboxKey(ACME.tenantId));
  return raw ? JSON.parse(raw) : [];
}

const soon = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test('a request that never answers does not hold up the sale behind it, and uses no attempt', async () => {
  const hanging: Array<(answer: unknown) => void> = [];
  const asked: string[] = [];
  net = installFetch([
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }],
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
    [mobileUrl('palmart'), { status: 200, body: mobileBody(PALMART) }],
    [
      salesUrl,
      (_url: string, init: { body?: string }) => {
        const body = JSON.parse(String(init.body)) as { n: string };
        asked.push(body.n);
        // The first sale's request is on a line that never answers; every other is taken at once.
        if (body.n === 'a1' && hanging.length === 0) {
          return new Promise((resolve) => hanging.push(resolve));
        }
        return { status: 200, body: { id: `sale-${body.n}` } };
      },
    ],
  ]) as Handle;
  assert.equal((await openStore('acme', API, { audience: 'staff', keepUnsent: false })).kind, 'opened');
  await outbox.enqueue(sale('a1'));
  await outbox.enqueue(sale('a2'));

  const lost: string[] = [];
  const engine = createSyncEngine({
    api: boundApi(createApiClient({ baseURL: API }), 40, { lost: () => lost.push('lost') }),
  });

  await engine.sync();

  assert.deepEqual(asked, ['a1', 'a2'], 'the second sale was tried although the first had not answered');
  const left = queued();
  assert.deepEqual(left.map((item) => item.id), ['a1'], 'the second sale went; the first is still waiting');
  assert.equal(left[0].retries, 0, 'a request that was not answered is not a failed attempt');
  assert.equal(left[0].conflictType, undefined, 'and it is not flagged for anybody');
  assert.deepEqual(lost, ['lost'], 'the till was told the line may be down');
  assert.equal(isBeingSent('a1'), true, 'the first request may still be on its way');

  // A pass that starts while the first request may still be out leaves that sale alone: no second request beside it.
  await engine.sync();
  assert.deepEqual(asked, ['a1', 'a2'], 'nothing was sent twice at once');

  // The first request ends (late, and recorded by the server). The sale is let go, and the next pass sends it under
  // the same key, which the server recognises. It leaves the queue.
  hanging[0]({ status: 200, body: { id: 'sale-a1' } });
  await soon();
  await soon();
  assert.equal(isBeingSent('a1'), false);
  await engine.sync();
  assert.deepEqual(asked, ['a1', 'a2', 'a1']);
  assert.deepEqual(queued(), [], 'the queue is empty');
});
