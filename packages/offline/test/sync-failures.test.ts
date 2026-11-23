// Run from mobile/ the same way as outbox.test.ts (see there).
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore, freshPhone, installFetch } from '../../core/test/support/world.mjs';
import { ACME, API, BOBS, PALMART, mobileBody, mobileUrl } from '../../core/test/fixtures';
import { configureStorage } from '../../core/src/storage';
import * as K from '../../core/src/storage-keys';
import { createApiClient, openStore } from '@kiosk/core';
import { createSyncEngine, needsAttention, outbox, retryStuck, summarizeOutbox } from '../src/index';

type Handle = { calls: Array<{ url: string; method: string }>; restore(): void };
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

type Answer = { status: number; body?: unknown } | 'offline';

/** A server that answers every sale with `answer()`, and counts how many it was asked to take. */
function salesServer(answer: () => Answer) {
  let asked = 0;
  const route = [
    salesUrl,
    () => {
      asked += 1;
      const reply = answer();
      if (reply === 'offline') throw new TypeError('Network request failed');
      return reply;
    },
  ];
  return { asked: () => asked, route };
}

function serve(routes: unknown[]) {
  net?.restore();
  net = installFetch(routes) as Handle;
}

function shops(): unknown[] {
  return [
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }],
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
    [mobileUrl('palmart'), { status: 200, body: mobileBody(PALMART) }],
  ];
}

async function openAcme() {
  const result = await openStore('acme', API, { audience: 'staff', keepUnsent: false });
  assert.equal(result.kind, 'opened');
}

function sale(id: string) {
  return { id, method: 'POST', path: '/api/v1/sales', body: { n: id }, idempotencyKey: `key-${id}` };
}

function queued(): Array<Record<string, unknown>> {
  const raw = asyncStore.__store.get(K.outboxKey(ACME.tenantId));
  return raw ? JSON.parse(raw) : [];
}

const problem = (status: number, extra: Record<string, unknown> = {}) => ({
  status,
  body: { title: 'Bad Request', detail: 'The server said so', ...extra },
});

async function passes(engine: { sync(): Promise<void> }, count: number) {
  for (let i = 0; i < count; i += 1) await engine.sync();
}

test('a phone that was offline for many passes has used no attempts, and the sale is still just waiting', async () => {
  const server = salesServer(() => 'offline');
  serve([...shops(), server.route]);
  await openAcme();
  await outbox.enqueue(sale('a1'));
  const attention: string[] = [];
  const engine = createSyncEngine({ api: createApiClient({ baseURL: API }), onNeedsAttention: (i) => attention.push(i.id) });

  await passes(engine, 12);

  assert.equal(server.asked(), 12, 'it kept trying');
  const [item] = queued();
  assert.equal(item?.retries, 0);
  assert.equal(item?.lastError, undefined);
  assert.deepEqual(attention, []);
  assert.deepEqual(await summarizeOutbox(), { total: 1, needsAttention: 0 });
});

test('a server that cannot take the sale just now (busy, shop off, session over) uses no attempts either', async () => {
  for (const status of [401, 408, 423, 429]) {
    const server = salesServer(() => problem(status));
    serve([...shops(), server.route]);
    asyncStore.__store.clear();
    freshPhone({});
    configureStorage(null);
    serve([...shops(), server.route]);
    await openAcme();
    await outbox.enqueue(sale('a1'));
    await passes(createSyncEngine({ api: createApiClient({ baseURL: API }) }), 6);
    const [item] = queued();
    assert.equal(item?.retries, 0, `status ${status}`);
    assert.equal(item?.conflictType, undefined, `status ${status}`);
  }
});

test('a sale waiting for a step is told what it is waiting for, uses no attempts, and goes through once the step is done', async () => {
  let open = false;
  const server = salesServer(() =>
    open
      ? { status: 201, body: { ok: true } }
      : problem(403, { code: 'setup_required', requirement: 'shift', detail: 'Open a shift first' })
  );
  serve([...shops(), server.route]);
  await openAcme();
  await outbox.enqueue(sale('a1'));
  const engine = createSyncEngine({ api: createApiClient({ baseURL: API }), maxRetries: 3 });

  await passes(engine, 8);
  const [waiting] = queued();
  assert.equal(waiting?.retries, 0);
  assert.match(String(waiting?.lastError), /Open a shift first/);
  assert.equal(needsAttention({ ...(waiting as never) }), false);

  open = true;
  await engine.sync();
  assert.deepEqual(queued(), []);
});

test('a sale waiting for a step is written to the phone when its answer changes, and not again while the answer stays the same', async () => {
  let detail = 'Open a shift first';
  const server = salesServer(() => problem(403, { code: 'setup_required', requirement: 'shift', detail }));
  serve([...shops(), server.route]);
  await openAcme();
  await outbox.enqueue(sale('a1'));
  const engine = createSyncEngine({ api: createApiClient({ baseURL: API }), maxRetries: 3 });
  const queueKey = K.outboxKey(ACME.tenantId);
  let writes = 0;
  asyncStore.__setFault((op: string, key: string) => {
    if (op === 'set' && key === queueKey) writes += 1;
  });

  await engine.sync();
  assert.equal(writes, 1, 'the first answer is written');
  await passes(engine, 5);
  assert.equal(server.asked(), 6, 'it kept asking');
  assert.equal(writes, 1, 'the same answer is not written again');

  detail = 'Ask a manager to approve this till';
  await passes(engine, 3);
  assert.equal(writes, 2, 'a new answer is written once');
  assert.match(String(queued()[0]?.lastError), /approve this till/);
  asyncStore.__setFault(null);
});

test('a sale the server refuses is flagged for a person at once, reported once, and not sent again by itself', async () => {
  const server = salesServer(() => problem(400, { detail: 'Unsupported payment method' }));
  serve([...shops(), server.route]);
  await openAcme();
  await outbox.enqueue(sale('a1'));
  const attention: string[] = [];
  const engine = createSyncEngine({
    api: createApiClient({ baseURL: API }),
    onNeedsAttention: (item) => attention.push(`${item.id}:${item.conflictType}:${item.lastError}`),
  });

  await passes(engine, 4);

  assert.equal(server.asked(), 1, 'asked once, and not again');
  assert.deepEqual(attention, ['a1:refused:Unsupported payment method']);
  const [item] = queued();
  assert.equal(item?.conflictType, 'refused');
  assert.equal(item?.retries, 0);
  assert.deepEqual(await summarizeOutbox(), { total: 1, needsAttention: 1 });
});

test('a refused sale goes back in play when a person says so', async () => {
  let accept = false;
  const server = salesServer(() => (accept ? { status: 201, body: { ok: true } } : problem(403)));
  serve([...shops(), server.route]);
  await openAcme();
  await outbox.enqueue(sale('a1'));
  const engine = createSyncEngine({ api: createApiClient({ baseURL: API }) });
  await passes(engine, 2);
  assert.equal(server.asked(), 1);

  accept = true;
  assert.equal(await retryStuck(), 1);
  await engine.sync();
  assert.deepEqual(queued(), []);
});

test('a conflict is read from the status, not from the words', async () => {
  const server = salesServer(() => problem(409, { detail: 'Shift closed before sale completed' }));
  serve([...shops(), server.route]);
  await openAcme();
  await outbox.enqueue(sale('a1'));
  const conflicts: string[] = [];
  await createSyncEngine({ api: createApiClient({ baseURL: API }), onConflict: (i) => conflicts.push(i.id) }).sync();
  assert.deepEqual(conflicts, ['a1']);
  assert.equal(queued()[0]?.conflictType, 'sync_conflict');
  assert.equal(queued()[0]?.retries, 0);
});

test('a server error that says "conflict" is still a server error and counts as an attempt', async () => {
  const server = salesServer(() => problem(500, { detail: 'conflict in the database' }));
  serve([...shops(), server.route]);
  await openAcme();
  await outbox.enqueue(sale('a1'));
  const conflicts: string[] = [];
  await createSyncEngine({ api: createApiClient({ baseURL: API }), onConflict: (i) => conflicts.push(i.id) }).sync();
  assert.deepEqual(conflicts, []);
  assert.equal(queued()[0]?.conflictType, undefined);
  assert.equal(queued()[0]?.retries, 1);
});
