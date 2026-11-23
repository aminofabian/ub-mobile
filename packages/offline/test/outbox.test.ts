// Run from mobile/ (Node 22.18+; on 22.6-22.17 add --experimental-strip-types):
//   node --import ./packages/core/test/support/register.mjs --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     --test packages/offline/test/outbox.test.ts
// The register hook stands in fakes for the native modules and points @kiosk/core at its sources.
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore, freshPhone, installFetch, offlineNetwork, secureStore } from '../../core/test/support/world.mjs';
import { ACME, API, BOBS, PALMART, hostBody, mobileBody, mobileUrl } from '../../core/test/fixtures';
import type { ApiClient } from '@kiosk/core';
import { configureStorage } from '../../core/src/storage';
import * as K from '../../core/src/storage-keys';
import {
  bootstrapStore,
  createApiClient,
  forgetStore,
  getAccessToken,
  getActiveTenantId,
  loadStoreById,
  openStore,
  revalidateActive,
  storeTokens,
  switchStore,
} from '@kiosk/core';
import {
  ATTENTION_AFTER_RETRIES,
  createSyncEngine,
  exportOutbox,
  needsAttention,
  outbox,
  outboxFor,
  retryStuck,
  subscribeOutbox,
  summarizeOutbox,
} from '../src/index';
import { EXPORT_ERROR_LIMIT, EXPORT_UNREADABLE_LIMIT, clipText } from '../src/outbox';

type Handle = { calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: unknown }>; restore(): void };
let net: Handle | null = null;

beforeEach(() => {
  freshPhone({});
  configureStorage(null);
});

afterEach(() => {
  net?.restore();
  net = null;
});

function serve(routes: unknown[]): Handle {
  net?.restore();
  net = installFetch(routes) as Handle;
  return net;
}

function shops(): unknown[] {
  return [
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }],
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
    [mobileUrl('palmart'), { status: 200, body: mobileBody(PALMART) }],
  ];
}

async function open(input: string, keepUnsent = false) {
  const result = await openStore(input, API, { audience: 'staff', keepUnsent });
  assert.equal(result.kind, 'opened', `opening ${input}: ${JSON.stringify(result)}`);
}

function sale(id: string) {
  return { id, method: 'POST', path: '/api/v1/sales', body: { n: id }, idempotencyKey: `key-${id}` };
}

const ids = (items: Array<{ id: string }>) => items.map((item) => item.id);

function rawQueue(tenantId: string): Array<Record<string, unknown>> {
  const raw = asyncStore.__store.get(K.outboxKey(tenantId));
  return raw ? JSON.parse(raw) : [];
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

// ---------------------------------------------------------------------------------------------
// One queue per shop
// ---------------------------------------------------------------------------------------------

test('each shop has its own queue; the active-shop outbox follows whichever shop is open', async () => {
  serve(shops());
  await open('acme');
  await outbox.enqueue(sale('a1'));
  await open('bobs', true);
  await outbox.enqueue(sale('b1'));

  assert.deepEqual(ids(await outbox.pending()), ['b1']);
  assert.deepEqual(ids(await outboxFor(ACME.tenantId).pending()), ['a1']);
  assert.deepEqual(rawQueue(ACME.tenantId).map((i) => [i.id, i.tenantId]), [['a1', ACME.tenantId]]);
  assert.deepEqual(rawQueue(BOBS.tenantId).map((i) => [i.id, i.tenantId]), [['b1', BOBS.tenantId]]);
  assert.equal(asyncStore.__store.has('@kiosk/offline/outbox'), false, 'the old shared key is not used');

  // Changing one shop's queue leaves the other alone.
  await outboxFor(BOBS.tenantId).markRetry('b1', 'offline');
  await outboxFor(ACME.tenantId).update('a1', { lastError: 'x' });
  assert.equal(rawQueue(BOBS.tenantId)[0]?.retries, 1);
  assert.equal(rawQueue(ACME.tenantId)[0]?.retries, 0);
  assert.equal(rawQueue(BOBS.tenantId)[0]?.lastError, 'offline');

  await open('acme', true);
  assert.deepEqual(ids(await outbox.pending()), ['a1']);
  await outbox.remove('a1');
  assert.deepEqual(ids(await outbox.pending()), []);
  assert.equal(asyncStore.__store.has(K.outboxKey(ACME.tenantId)), false, 'an empty queue leaves no key behind');
  assert.deepEqual(ids(await outboxFor(BOBS.tenantId).pending()), ['b1']);
});

test('with no shop open a sale is refused, not parked somewhere it could be sent to the wrong shop', async () => {
  await assert.rejects(outbox.enqueue(sale('x')), /Select a store first/);
  assert.deepEqual(await outbox.pending(), []);
  await outbox.remove('x');
  assert.deepEqual([...asyncStore.__store.keys()].filter((key) => key.includes('outbox')), []);
});

test('a sale cannot be added to the queue of a different shop', async () => {
  serve(shops());
  await open('acme');
  await open('bobs', true);
  await assert.rejects(outboxFor(BOBS.tenantId).enqueue({ ...sale('x'), tenantId: ACME.tenantId }), /different store/);
  assert.deepEqual(rawQueue(ACME.tenantId), []);
  assert.deepEqual(rawQueue(BOBS.tenantId), []);
  assert.throws(() => outboxFor('not a shop id'), /Invalid|tenant/i);
});

test('a forgotten shop takes no new sales, but the ones it still holds can be read and exported', async () => {
  serve(shops());
  await open('acme');
  await outbox.enqueue(sale('a1'));
  await forgetStore(ACME.tenantId);

  await assert.rejects(outboxFor(ACME.tenantId).enqueue(sale('a2')), /no longer on this phone/);
  assert.deepEqual(ids(await outboxFor(ACME.tenantId).pending()), ['a1']);
  assert.deepEqual(JSON.parse(await exportOutbox(ACME.tenantId)).items.map((i: { id: string }) => i.id), ['a1']);
});

test('an export keeps what the server said about a sale short, and leaves the sale itself whole', async () => {
  serve(shops());
  await open('acme');
  await outbox.enqueue(sale('a1'));
  await outbox.enqueue(sale('a2'));
  await outbox.markRetry('a1', 'x'.repeat(EXPORT_ERROR_LIMIT * 10));
  await outbox.markRetry('a2', 'Shift required');

  const exported = JSON.parse(await exportOutbox());
  const [a1, a2] = exported.items;
  assert.equal(a1.id, 'a1');
  assert.deepEqual(a1.body, { n: 'a1' }, 'the sale is not touched');
  assert.equal(a1.idempotencyKey, 'key-a1');
  assert.equal(a1.lastError.startsWith('x'.repeat(EXPORT_ERROR_LIMIT)), true);
  assert.match(a1.lastError, /\.\.\. \(2700 more characters not copied\)$/);
  assert.equal(a1.lastError.length < EXPORT_ERROR_LIMIT + 60, true, 'a web page of error is not carried');
  assert.equal(a2.lastError, 'Shift required', 'a short answer is kept as it was');
  // What is on the phone is not shortened, only the copy.
  assert.equal((await outbox.pending())[0].lastError?.length, EXPORT_ERROR_LIMIT * 10);
});

test('an export keeps a damaged queue short too, so one message can carry it', async () => {
  serve(shops());
  await open('acme');
  asyncStore.__store.set(K.outboxKey(ACME.tenantId), 'not json {' + 'y'.repeat(EXPORT_UNREADABLE_LIMIT * 2));
  await outbox.enqueue(sale('a1'));
  const exported = JSON.parse(await exportOutbox());
  assert.equal(exported.unreadable.startsWith('not json {yyy'), true);
  assert.match(exported.unreadable, /more characters not copied\)$/);
  assert.equal(exported.unreadable.length < EXPORT_UNREADABLE_LIMIT + 60, true);
  assert.equal(
    asyncStore.__store.get(K.unreadableOutboxKey(ACME.tenantId))?.length,
    'not json {'.length + EXPORT_UNREADABLE_LIMIT * 2,
    'the phone still holds all of it',
  );
});

test('clipText cuts by characters, never through an emoji, and says how much it left out', () => {
  assert.equal(clipText('short', 10), 'short');
  assert.equal(clipText('exactly10!', 10), 'exactly10!');
  assert.equal(clipText('abcdefghijk', 10), 'abcdefghij... (1 more character not copied)');
  assert.equal(clipText('abcdefghijkl', 10), 'abcdefghij... (2 more characters not copied)');
  const hearts = '😀'.repeat(20);
  assert.equal(hearts.length, 40, 'forty UTF-16 units');
  assert.equal(clipText(hearts, 40), hearts, 'twenty characters are under a limit of forty');
  assert.equal(clipText(hearts, 30), hearts, 'forty UTF-16 units, but only twenty characters, are under a limit of thirty');
  assert.equal(clipText(hearts, 20), hearts, 'exactly the limit, counted in characters');
  assert.equal(clipText(hearts, 19), `${'😀'.repeat(19)}... (1 more character not copied)`);
  assert.equal(clipText(hearts, 10).startsWith('😀'.repeat(10)), true);
  assert.equal(clipText(hearts, 10).includes('\uFFFD'), false);
  assert.equal(clipText('', 5), '');
});

test('queuing the same sale twice keeps one copy', async () => {
  serve(shops());
  await open('acme');
  await outbox.enqueue(sale('a1'));
  await outbox.enqueue({ ...sale('a1'), body: { n: 'different' } });
  const items = await outbox.pending();
  assert.equal(items.length, 1);
  assert.deepEqual(items[0]?.body, { n: 'a1' }, 'the first copy stays');
});

test('sales queued at the same moment are all kept, and none is lost to a removal alongside', async () => {
  serve(shops());
  await open('acme');
  await Promise.all(Array.from({ length: 40 }, (_, i) => outbox.enqueue(sale(`s${i}`))));
  assert.equal((await outbox.pending()).length, 40);

  await Promise.all([
    ...Array.from({ length: 20 }, (_, i) => outbox.remove(`s${i * 2}`)),
    ...Array.from({ length: 20 }, (_, i) => outbox.enqueue(sale(`n${i}`))),
    ...Array.from({ length: 10 }, (_, i) => outbox.markRetry(`s${i * 2 + 1}`, 'x')),
  ]);
  const after = await outbox.pending();
  assert.equal(after.length, 40);
  assert.deepEqual(new Set(ids(after)).size, 40);
  assert.equal(after.filter((i) => i.retries === 1).length, 10);
  assert.equal(after.filter((i) => i.id.startsWith('n')).length, 20);
});

test('a queue that cannot be read is kept for support and does not stop new sales', async () => {
  serve(shops());
  await open('acme');
  const key = K.outboxKey(ACME.tenantId);
  asyncStore.__store.set(key, 'not json {');

  assert.deepEqual(await outbox.pending(), []);
  assert.equal(asyncStore.__store.has(K.unreadableOutboxKey(ACME.tenantId)), false, 'reading alone writes nothing');

  await outbox.enqueue(sale('a1'));
  assert.deepEqual(ids(await outbox.pending()), ['a1']);
  assert.equal(asyncStore.__store.get(K.unreadableOutboxKey(ACME.tenantId)), 'not json {');
  assert.equal(JSON.parse(await exportOutbox()).unreadable, 'not json {');

  // A second problem does not overwrite the first record of what was lost.
  asyncStore.__store.set(key, '{"also":"wrong"}');
  await outbox.enqueue(sale('a2'));
  assert.equal(asyncStore.__store.get(K.unreadableOutboxKey(ACME.tenantId)), 'not json {');

  // Entries that are intact survive a damaged neighbour.
  asyncStore.__store.set(key, JSON.stringify([{ ...sale('ok'), retries: 0, createdAt: 'x' }, 5, null]));
  await outbox.enqueue(sale('a3'));
  assert.deepEqual(ids(await outbox.pending()), ['ok', 'a3']);

  await forgetStore(ACME.tenantId, { dropOutbox: true });
  assert.equal(asyncStore.__store.has(K.unreadableOutboxKey(ACME.tenantId)), false, 'forgetting a shop removes that too');
});

test('what needs a person is the same list everywhere: conflicts and sales that failed three times', async () => {
  serve(shops());
  await open('acme');
  for (const id of ['fresh', 'twice', 'thrice', 'conflict']) await outbox.enqueue(sale(id));
  await outbox.markRetry('twice');
  await outbox.markRetry('twice');
  for (let i = 0; i < ATTENTION_AFTER_RETRIES; i += 1) await outbox.markRetry('thrice', 'no network');
  await outbox.update('conflict', { conflictType: 'sync_conflict', lastError: '409' });

  const items = await outbox.pending();
  assert.deepEqual(items.filter(needsAttention).map((i) => i.id), ['thrice', 'conflict']);
  assert.deepEqual(await summarizeOutbox(), { total: 4, needsAttention: 2 });
  assert.deepEqual(await summarizeOutbox(ACME.tenantId), { total: 4, needsAttention: 2 });
  assert.deepEqual(await summarizeOutbox(BOBS.tenantId), { total: 0, needsAttention: 0 });

  assert.equal(await retryStuck(), 2);
  assert.deepEqual(await summarizeOutbox(), { total: 4, needsAttention: 0 });
  const again = await outbox.pending();
  assert.deepEqual(again.map((i) => [i.id, i.retries, i.conflictType, i.lastError]), [
    ['fresh', 0, undefined, undefined],
    ['twice', 2, undefined, undefined],
    ['thrice', 0, undefined, undefined],
    ['conflict', 0, undefined, undefined],
  ]);
  assert.equal(await retryStuck(), 0);
});

test('whoever is watching hears about each real change to a queue, and a listener that throws does not matter', async () => {
  serve(shops());
  await open('acme');
  await open('bobs', true);
  const heard: string[] = [];
  const stopBad = subscribeOutbox(() => {
    throw new Error('listener bug');
  });
  const stop = subscribeOutbox((change) => heard.push(change.tenantId === ACME.tenantId ? 'acme' : 'bobs'));

  await outboxFor(ACME.tenantId).enqueue(sale('a1'));
  await outbox.enqueue(sale('b1'));
  await outbox.markRetry('b1', 'x');
  await outbox.remove('nothing-with-this-id');
  await outbox.update('nothing-with-this-id', {});
  await outbox.enqueue(sale('b1')); // already there
  await outbox.remove('b1');
  assert.deepEqual(heard, ['acme', 'bobs', 'bobs', 'bobs']);

  stop();
  stopBad();
  await outbox.enqueue(sale('b2'));
  assert.equal(heard.length, 4);
  assert.equal((await exportOutbox()).includes('"b2"'), true);
});

// ---------------------------------------------------------------------------------------------
// Leaving a shop with sales that were never sent
// ---------------------------------------------------------------------------------------------

test('leaving a shop with unsent sales asks first; keeping them lets it through and they wait in their own queue', async () => {
  serve(shops());
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  await outbox.enqueue(sale('a1'));
  await outbox.enqueue(sale('a2'));
  await outbox.update('a2', { conflictType: 'sync_conflict' });

  assert.deepEqual(await switchStore(null), { kind: 'blocked', reason: 'unsent_sales', unsent: { total: 2, needsAttention: 1 } });
  assert.equal(await getActiveTenantId(), ACME.tenantId);
  assert.equal(await getAccessToken(), 'A-access');
  const refused = await openStore('bobs', API, { audience: 'staff' });
  assert.equal(refused.kind, 'blocked');

  await open('bobs', true);
  assert.equal(await getAccessToken(ACME.tenantId), 'A-access', 'the session stays so the queue can still be sent');
  assert.deepEqual(ids(await outboxFor(ACME.tenantId).pending()), ['a1', 'a2']);
  assert.deepEqual(await outbox.pending(), []);

  // Bob's has nothing queued, so leaving it is not asked about, and ends its session.
  await storeTokens({ accessToken: 'B-access', refreshToken: 'B-refresh' });
  await open('acme');
  assert.equal(await getAccessToken(BOBS.tenantId), null);
});

// ---------------------------------------------------------------------------------------------
// A Palmart upgrade: the queue it already holds, and the moment the server names the shop
// ---------------------------------------------------------------------------------------------

const PALMART_BUILD = { embeddedTenantSlug: 'palmart', isWhiteLabel: true, tenantHost: 'palmart.co.ke' };

function goOffline(): Handle {
  net?.restore();
  net = offlineNetwork() as Handle;
  return net;
}

/** A phone that has Palmart on the old layout with one sale unsent, opened with no network. */
async function palmartUpgradeOffline() {
  freshPhone(PALMART_BUILD);
  configureStorage(null);
  secureStore.__store.set(
    K.LEGACY_SECURE.tenant,
    JSON.stringify({ businessId: 'a-branch-id-the-old-code-guessed', slug: 'palmart', host: 'palmart.co.ke', displayName: 'Palmart Mini Mart', branding: {} }),
  );
  secureStore.__store.set(K.LEGACY_SECURE.accessToken, 'access-v1');
  secureStore.__store.set(K.LEGACY_SECURE.refreshToken, 'refresh-v1');
  asyncStore.__store.set(
    K.LEGACY_PLAIN.outbox,
    JSON.stringify([{ id: 'sale-1', method: 'POST', path: '/api/v1/sales', body: {}, idempotencyKey: 'k1', retries: 0, createdAt: '2026-11-20T08:00:00.000Z' }]),
  );
  goOffline();
  const boot = await bootstrapStore(API, { audience: 'staff' });
  assert.equal(boot.kind, 'ready');
  await settle(); // the check it started in the background fails, as there is no network
}

test('a Palmart upgrade keeps its queued sale, new sales join it, and all of it settles on the real id', async () => {
  await palmartUpgradeOffline();
  const carried = await outbox.pending();
  assert.deepEqual(ids(carried), ['sale-1']);
  assert.equal(carried[0]?.tenantId, 'pending-palmart');
  await outbox.enqueue(sale('new-1'));
  assert.deepEqual(rawQueue('pending-palmart').map((i) => i.id), ['sale-1', 'new-1']);
  assert.deepEqual(await summarizeOutbox(), { total: 2, needsAttention: 0 });

  serve(shops());
  assert.equal((await revalidateActive(API, { audience: 'staff' }))?.kind, 'found');
  assert.equal(await getActiveTenantId(), PALMART.tenantId);
  assert.deepEqual(rawQueue(PALMART.tenantId).map((i) => [i.id, i.tenantId]), [
    ['sale-1', PALMART.tenantId],
    ['new-1', PALMART.tenantId],
  ]);
  assert.equal(asyncStore.__store.has(K.outboxKey('pending-palmart')), false);
  assert.deepEqual(ids(await outbox.pending()), ['sale-1', 'new-1']);
});

test('a sale queued at any moment while the server names the shop is neither lost nor left in the old name', async () => {
  for (let delay = 0; delay <= 120; delay += 1) {
    await palmartUpgradeOffline();
    serve(shops());
    const naming = revalidateActive(API, { audience: 'staff' });
    for (let tick = 0; tick < delay; tick += 1) await Promise.resolve();
    await outbox.enqueue(sale('racer'));
    await naming;

    assert.equal(await getActiveTenantId(), PALMART.tenantId, `delay ${delay}`);
    assert.deepEqual(rawQueue(PALMART.tenantId).map((i) => i.id).sort(), ['racer', 'sale-1'], `delay ${delay}`);
    for (const key of [...asyncStore.__store.keys(), ...secureStore.__store.keys()]) {
      assert.equal(key.includes('pending-'), false, `delay ${delay}: ${key}`);
    }
  }
});

test('a caller that took the provisional name before the server confirmed the shop still reaches the right queue', async () => {
  await palmartUpgradeOffline();
  const early = outboxFor('pending-palmart');
  serve(shops());
  await revalidateActive(API, { audience: 'staff' });
  assert.equal(await loadStoreById('pending-palmart'), null);

  await early.enqueue(sale('late'));
  assert.deepEqual(rawQueue(PALMART.tenantId).map((i) => i.id).sort(), ['late', 'sale-1']);
  assert.equal(asyncStore.__store.has(K.outboxKey('pending-palmart')), false);
  assert.deepEqual(ids(await early.pending()).sort(), ['late', 'sale-1']);
  assert.deepEqual(await summarizeOutbox('pending-palmart'), { total: 2, needsAttention: 0 });
});

// ---------------------------------------------------------------------------------------------
// The sync engine
// ---------------------------------------------------------------------------------------------

const salesUrl = `${API}/api/v1/sales`;

type Sent = { n: string; shop: string | undefined; key: string | undefined };

/** A fake sales endpoint. `answer` decides what the server says to each sale; `before` runs while the request is in flight. */
function salesServer(options: { answer?: (n: string) => { status: number; body?: unknown }; before?: (n: string) => Promise<void> } = {}) {
  const seen: Sent[] = [];
  const route = [
    salesUrl,
    async (_url: string, init: { headers: Record<string, string>; body?: string }) => {
      const n = (JSON.parse(String(init.body)) as { n: string }).n;
      seen.push({ n, shop: init.headers['X-Tenant-Id'], key: init.headers['Idempotency-Key'] });
      await options.before?.(n);
      return options.answer ? options.answer(n) : { status: 201, body: { ok: true } };
    },
  ];
  return { seen, route };
}

async function waitFor(condition: () => boolean, ms = 3000): Promise<void> {
  const until = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > until) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test("an engine for one shop sends only that shop's queue, with that shop's headers and each sale's own key", async () => {
  const server = salesServer();
  serve([...shops(), server.route]);
  await open('acme');
  await outbox.enqueue(sale('a1'));
  await outbox.enqueue(sale('a2'));
  await open('bobs', true);
  await outbox.enqueue(sale('b1'));

  const synced: string[] = [];
  const engine = createSyncEngine({
    api: createApiClient({ baseURL: API, tenantId: ACME.tenantId }),
    tenantId: ACME.tenantId,
    onSynced: (item) => synced.push(item.id),
  });
  await engine.sync();

  assert.deepEqual(server.seen, [
    { n: 'a1', shop: ACME.tenantId, key: 'key-a1' },
    { n: 'a2', shop: ACME.tenantId, key: 'key-a2' },
  ]);
  assert.deepEqual(synced, ['a1', 'a2']);
  assert.deepEqual(rawQueue(ACME.tenantId), []);
  assert.deepEqual(rawQueue(BOBS.tenantId).map((i) => i.id), ['b1']);
});

test('an engine that follows the active shop sends through a client pinned to the shop it is sending for, so a switch mid-send cannot redirect a sale', async () => {
  const server = salesServer({
    before: async (n) => {
      if (n === 'a1') await open('bobs', true); // the person switches shops while the first sale is on its way
    },
  });
  serve([...shops(), server.route]);
  await open('acme');
  await outbox.enqueue(sale('a1'));
  await outbox.enqueue(sale('a2'));

  await createSyncEngine({ api: createApiClient({ baseURL: API }) }).sync();

  assert.equal(await getActiveTenantId(), BOBS.tenantId);
  assert.deepEqual(server.seen.map((s) => [s.n, s.shop]), [['a1', ACME.tenantId], ['a2', ACME.tenantId]]);
  assert.deepEqual(rawQueue(ACME.tenantId), []);
});

test('a client that cannot be pinned is watched instead: the engine stops sending when the shop changes', async () => {
  serve(shops());
  await open('acme');
  await outbox.enqueue(sale('a1'));
  await outbox.enqueue(sale('a2'));

  const sent: string[] = [];
  const unpinned = {
    get: async () => undefined,
    patch: async () => undefined,
    delete: async () => undefined,
    post: async (_path: string, body: { n: string }) => {
      sent.push(body.n);
      if (body.n === 'a1') await open('bobs', true);
      return {};
    },
  } as unknown as ApiClient;

  await createSyncEngine({ api: unpinned }).sync();
  assert.deepEqual(sent, ['a1']);
  assert.deepEqual(rawQueue(ACME.tenantId).map((i) => i.id), ['a2'], 'the one that went is removed, the other waits for its own shop');
});

test('a sale filed under a shop it does not belong to is never sent', async () => {
  const server = salesServer();
  serve([...shops(), server.route]);
  await open('acme');
  await outbox.enqueue(sale('good'));
  const queued = rawQueue(ACME.tenantId);
  asyncStore.__store.set(
    K.outboxKey(ACME.tenantId),
    JSON.stringify([...queued, { ...sale('misfiled'), retries: 0, createdAt: 'x', tenantId: BOBS.tenantId }]),
  );

  await createSyncEngine({ api: createApiClient({ baseURL: API }) }).sync();
  assert.deepEqual(server.seen.map((s) => s.n), ['good']);
  assert.deepEqual(rawQueue(ACME.tenantId).map((i) => i.id), ['misfiled']);
});

test('an engine for a shop this phone has forgotten sends nothing', async () => {
  const server = salesServer();
  serve([...shops(), server.route]);
  await open('acme');
  await outbox.enqueue(sale('a1'));
  await forgetStore(ACME.tenantId);
  await createSyncEngine({ api: createApiClient({ baseURL: API, tenantId: ACME.tenantId }), tenantId: ACME.tenantId }).sync();
  assert.deepEqual(server.seen, []);
  assert.deepEqual(rawQueue(ACME.tenantId).map((i) => i.id), ['a1']);
});

test('with no shop open there is nothing to send', async () => {
  const server = salesServer();
  serve([server.route]);
  await createSyncEngine({ api: createApiClient({ baseURL: API }) }).sync();
  assert.deepEqual(server.seen, []);
});

test('a sale that keeps failing is reported once, when the engine gives up on it, and can be put back in play', async () => {
  let mode: 'fail' | 'ok' = 'fail';
  const server = salesServer({
    answer: () => (mode === 'ok' ? { status: 201, body: {} } : { status: 500, body: { title: 'Internal Server Error', detail: 'boom' } }),
  });
  serve([...shops(), server.route]);
  await open('acme');
  await outbox.enqueue(sale('a1'));
  const attention: string[] = [];
  const synced: string[] = [];
  const engine = createSyncEngine({
    api: createApiClient({ baseURL: API }),
    maxRetries: 3,
    onNeedsAttention: (item) => attention.push(`${item.id}:${item.retries}:${item.lastError}`),
    onSynced: (item) => synced.push(item.id),
  });

  await engine.sync();
  await engine.sync();
  assert.deepEqual(attention, []);
  await engine.sync();
  assert.deepEqual(attention, ['a1:3:boom']);

  await engine.sync();
  assert.equal(server.seen.length, 3, 'it is not tried again by itself');
  assert.deepEqual(attention, ['a1:3:boom'], 'and not reported again');
  assert.deepEqual(await summarizeOutbox(), { total: 1, needsAttention: 1 });

  mode = 'ok';
  assert.equal(await retryStuck(), 1);
  await engine.sync();
  assert.deepEqual(synced, ['a1']);
  assert.deepEqual(await outbox.pending(), []);
});

test('a conflict is handed to the app and marks the sale as needing a person, without using up its retries', async () => {
  const server = salesServer({ answer: () => ({ status: 409, body: { title: 'Conflict', detail: 'conflict' } }) });
  serve([...shops(), server.route]);
  await open('acme');
  await outbox.enqueue(sale('a1'));
  const conflicts: string[] = [];
  await createSyncEngine({ api: createApiClient({ baseURL: API }), onConflict: (item) => conflicts.push(item.id) }).sync();

  assert.deepEqual(conflicts, ['a1']);
  const [item] = await outbox.pending();
  assert.equal(item?.conflictType, 'sync_conflict');
  assert.equal(item?.retries, 0);
  assert.deepEqual(await summarizeOutbox(), { total: 1, needsAttention: 1 });
});

test('two passes that overlap send each sale once', async () => {
  const server = salesServer({ before: async () => void (await new Promise((resolve) => setTimeout(resolve, 10))) });
  serve([...shops(), server.route]);
  await open('acme');
  for (const id of ['a1', 'a2', 'a3']) await outbox.enqueue(sale(id));
  const engine = createSyncEngine({ api: createApiClient({ baseURL: API }) });
  await Promise.all([engine.sync(), engine.sync(), engine.sync()]);
  assert.deepEqual(server.seen.map((s) => s.n), ['a1', 'a2', 'a3']);
  await engine.sync(); // and a later pass starts fresh
  assert.equal(server.seen.length, 3);
});

test('started, the engine sends on its timer; stopped, it does not', async () => {
  const server = salesServer();
  serve([...shops(), server.route]);
  await open('acme');
  await outbox.enqueue(sale('a1'));
  const engine = createSyncEngine({ api: createApiClient({ baseURL: API }), intervalMs: 10 });
  engine.start();
  engine.start();
  await waitFor(() => server.seen.length === 1);
  engine.stop();
  engine.stop();
  await outbox.enqueue(sale('a2'));
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(server.seen.map((s) => s.n), ['a1']);
});

test('the whole round: a sale is queued offline, leaving is refused, it is sent, and then leaving is allowed and ends the session', async () => {
  const server = salesServer();
  serve([...shops(), server.route]);
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  await outbox.enqueue(sale('a1'));

  assert.equal((await switchStore(null)).kind, 'blocked');
  await createSyncEngine({ api: createApiClient({ baseURL: API }) }).sync();
  assert.deepEqual(server.seen.map((s) => s.n), ['a1']);

  assert.deepEqual(await switchStore(null), { kind: 'switched', store: null });
  assert.equal(await getAccessToken(ACME.tenantId), null);
});
