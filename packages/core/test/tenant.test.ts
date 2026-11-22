import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore, freshPhone, installFetch, offlineNetwork, reinstall, secureStore, setBuild } from './support/world.mjs';
import { configureStorage, plain } from '../src/storage';
import * as K from '../src/storage-keys';
import {
  StoreLookupError,
  StoreSwitchBlockedError,
  activateStore,
  clearActiveStore,
  clearTenant,
  forgetStore,
  getActiveTenantId,
  getTenantHeaders,
  listRememberedStores,
  loadActiveStore,
  loadStoreById,
  loadTenant,
  openStore,
  registerUnsentProbe,
  resolveTenant,
  revalidateActive,
  subscribeActiveStore,
  subscribeActiveStoreId,
  switchStore,
} from '../src/tenant';
import { bootstrapStore, bootstrapTenant } from '../src/embedded-tenant';
import { clearTokens, getAccessToken, storeTokens } from '../src/auth';
import { getOrCreateTillDeviceId } from '../src/till-device';
import { readTenantSecret, readTenantValue, writeTenantSecret, writeTenantValue } from '../src/tenant-data';
import { createApiClient } from '../src/create-api-client';
import { loginWithPassword, logout, refreshAccessToken } from '../src/auth-service';
import { resolveTenantFromDeepLink } from '../src/deep-link';
import { ACME, API, BOBS, PALMART, hostBody, hostUrl, mobileBody, mobileUrl } from './fixtures';

type Handle = { calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: unknown }>; restore(): void };
let net: Handle | null = null;

beforeEach(() => {
  freshPhone({});
  configureStorage(null);
  registerUnsentProbe(null);
});

afterEach(() => {
  net?.restore();
  net = null;
});

function allShops(): unknown[] {
  return [
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }],
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
    [mobileUrl('palmart'), { status: 200, body: mobileBody(PALMART) }],
  ];
}

function serve(routes: unknown[]): Handle {
  net?.restore();
  net = installFetch(routes) as Handle;
  return net;
}

async function open(input: string, keepUnsent = false) {
  const result = await openStore(input, API, { audience: 'staff', keepUnsent });
  assert.equal(result.kind, 'opened', `opening ${input}: ${JSON.stringify(result)}`);
  return (result as { store: NonNullable<Awaited<ReturnType<typeof loadActiveStore>>> }).store;
}

/** What @kiosk/offline will register: the length of a shop's queue. */
function countQueuesAsUnsent() {
  registerUnsentProbe(async (tenantId) => {
    const raw = asyncStore.__store.get(K.outboxKey(tenantId));
    const items = raw ? (JSON.parse(raw) as unknown[]) : [];
    return { total: items.length, needsAttention: 0 };
  });
}

async function queue(tenantId: string, items: unknown[]) {
  await (await plain()).set(K.outboxKey(tenantId), JSON.stringify(items));
}

function queued(tenantId: string): Array<Record<string, unknown>> {
  const raw = asyncStore.__store.get(K.outboxKey(tenantId));
  return raw ? JSON.parse(raw) : [];
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

// ---------------------------------------------------------------------------------------------
// The exit criteria
// ---------------------------------------------------------------------------------------------

test('two shops on one phone share no token, till id, profile, hint, device secret or queued sale', async () => {
  serve(allShops());
  countQueuesAsUnsent();

  const a = await open('acme');
  assert.deepEqual(getTenantHeaders(a), { 'X-Tenant-Host': 'acme.kiosk.ke', 'X-Tenant-Id': ACME.tenantId });
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  const tillA = await getOrCreateTillDeviceId();
  await writeTenantValue('profile', JSON.stringify({ name: 'A-user' }));
  await writeTenantValue('tabPhone', '0711111111');
  await writeTenantSecret('deviceSecret', 'A-device-secret');
  await queue(ACME.tenantId, [{ id: 'a1', tenantId: ACME.tenantId }]);

  // A has an unsent sale, so the switch has to be confirmed. Nothing changes until it is.
  const refused = await openStore('bobs', API, { audience: 'staff' });
  assert.equal(refused.kind, 'blocked');
  assert.equal(await getActiveTenantId(), ACME.tenantId);
  assert.equal(await getAccessToken(), 'A-access');

  const b = await open('bobs', true);
  assert.deepEqual(getTenantHeaders(b), { 'X-Tenant-Host': 'bobs.kiosk.ke', 'X-Tenant-Id': BOBS.tenantId });
  assert.equal(await getAccessToken(), null, "B does not see A's session");
  assert.equal(await readTenantValue('profile'), null);
  assert.equal(await readTenantValue('tabPhone'), null);
  assert.equal(await readTenantSecret('deviceSecret'), null);
  assert.deepEqual(queued(BOBS.tenantId), []);
  const tillB = await getOrCreateTillDeviceId();
  assert.ok(tillB && tillB !== tillA, 'each shop gets its own till id');

  await storeTokens({ accessToken: 'B-access', refreshToken: 'B-refresh' });
  await writeTenantValue('profile', JSON.stringify({ name: 'B-user' }));

  // A is exactly as it was left.
  assert.equal(await getAccessToken(ACME.tenantId), 'A-access');
  assert.equal(await getOrCreateTillDeviceId(ACME.tenantId), tillA);
  assert.equal(await readTenantValue('profile', ACME.tenantId), JSON.stringify({ name: 'A-user' }));
  assert.equal(await readTenantValue('tabPhone', ACME.tenantId), '0711111111');
  assert.equal(await readTenantSecret('deviceSecret', ACME.tenantId), 'A-device-secret');
  assert.equal(queued(ACME.tenantId).length, 1);

  // Back to A. B had nothing unsent, so its session ends on this phone; the rest of what B holds stays.
  await open('acme');
  assert.equal(await getAccessToken(), 'A-access');
  assert.equal(await getAccessToken(BOBS.tenantId), null);
  assert.equal(await readTenantValue('profile', BOBS.tenantId), JSON.stringify({ name: 'B-user' }));
  assert.equal(await getOrCreateTillDeviceId(BOBS.tenantId), tillB);
});

test('airplane mode reopens the last shop, and the background check changes nothing', async () => {
  serve(allShops());
  const opened = await open('acme');
  net?.restore();

  configureStorage(null); // the app is closed and opened again
  const offline = offlineNetwork();
  net = offline as Handle;
  const boot = await bootstrapStore(API, { audience: 'staff' });
  assert.equal(boot.kind, 'ready');
  if (boot.kind !== 'ready') return;
  assert.equal(boot.source, 'device');
  assert.deepEqual(boot.store, opened);

  await settle();
  assert.deepEqual(await loadActiveStore(), opened);
  assert.equal(offline.calls.length > 0, true, 'it did try to ask the server, in the background');
});

test('a fresh install on a phone with an old keychain starts empty, and its shops start clean', async () => {
  serve(allShops());
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  const tillBefore = await getOrCreateTillDeviceId();
  await writeTenantSecret('deviceSecret', 'A-device-secret');

  reinstall(); // app data gone, keychain kept (iOS)
  configureStorage(null);
  assert.ok(secureStore.__store.size > 0, "the keychain still holds the old install's secrets");

  assert.equal(await loadActiveStore(), null);
  assert.equal(await getAccessToken(), null);
  assert.equal(await getOrCreateTillDeviceId(), '', 'no shop, so no till id');
  assert.equal(secureStore.__store.size, 0, 'everything the old install left in the keychain is gone');

  await open('acme');
  assert.equal(await getAccessToken(), null);
  assert.equal(await readTenantSecret('deviceSecret'), null);
  assert.notEqual(await getOrCreateTillDeviceId(), tillBefore);
});

const PALMART_BUILD = { embeddedTenantSlug: 'palmart', isWhiteLabel: true, tenantHost: 'palmart.co.ke' };

function seedPalmartV1() {
  secureStore.__store.set(
    K.LEGACY_SECURE.tenant,
    JSON.stringify({ businessId: 'a-branch-id-the-old-code-guessed', slug: 'palmart', host: 'palmart.co.ke', displayName: 'Palmart Mini Mart', branding: { primaryColor: '#0a7d3b' } }),
  );
  secureStore.__store.set(K.LEGACY_SECURE.accessToken, 'access-v1');
  secureStore.__store.set(K.LEGACY_SECURE.refreshToken, 'refresh-v1');
  secureStore.__store.set(K.LEGACY_SECURE.tillDeviceId, 'till-v1');
  asyncStore.__store.set(K.LEGACY_PLAIN.outbox, JSON.stringify([{ id: 'sale-1', method: 'POST', path: '/api/v1/sales', body: {}, idempotencyKey: 'k1', retries: 0, createdAt: '2026-11-20T08:00:00.000Z' }]));
  asyncStore.__store.set(K.LEGACY_PLAIN.profile, JSON.stringify({ name: 'Wanjiru' }));
}

test('a Palmart upgrade opens offline with its session and queue, then settles on the real id', async () => {
  freshPhone(PALMART_BUILD);
  configureStorage(null);
  seedPalmartV1();

  const off = offlineNetwork();
  net = off as Handle;
  const boot = await bootstrapStore(API, { audience: 'staff' });
  assert.equal(boot.kind, 'ready');
  if (boot.kind !== 'ready') return;
  assert.equal(boot.source, 'device');
  assert.equal(boot.store.businessId, 'pending-palmart');
  assert.equal(boot.store.host, 'palmart.co.ke');
  assert.equal(boot.store.displayName, 'Palmart Mini Mart');
  assert.equal(await getAccessToken(), 'access-v1');
  assert.equal(await getOrCreateTillDeviceId(), 'till-v1');
  assert.equal(await readTenantValue('profile'), JSON.stringify({ name: 'Wanjiru' }));
  assert.equal(queued('pending-palmart').length, 1);
  // The server has not named the shop yet, so only its host is sent: a made-up id would not be.
  assert.deepEqual(getTenantHeaders(boot.store), { 'X-Tenant-Host': 'palmart.co.ke' });
  await settle();

  // Online again: the next check names the shop and everything moves to its real id.
  serve(allShops());
  const seen: Array<string | null> = [];
  const unsubscribe = subscribeActiveStore((store) => seen.push(store?.businessId ?? null));
  const result = await revalidateActive(API, { audience: 'staff' });
  unsubscribe();

  assert.equal(result?.kind, 'found');
  const store = await loadActiveStore();
  assert.equal(store?.businessId, PALMART.tenantId);
  assert.equal(store?.host, 'palmart.co.ke', 'the host that worked stays');
  assert.deepEqual(getTenantHeaders(store!), { 'X-Tenant-Host': 'palmart.co.ke', 'X-Tenant-Id': PALMART.tenantId });
  assert.equal(await getAccessToken(), 'access-v1');
  assert.equal(await getOrCreateTillDeviceId(), 'till-v1');
  assert.equal(await readTenantValue('profile'), JSON.stringify({ name: 'Wanjiru' }));
  assert.deepEqual(queued(PALMART.tenantId).map((i) => [i.id, i.tenantId]), [['sale-1', PALMART.tenantId]]);
  for (const key of [...secureStore.__store.keys(), ...asyncStore.__store.keys()]) assert.equal(key.includes('pending-'), false, key);
  assert.deepEqual(seen, [PALMART.tenantId]);

  configureStorage(null);
  assert.equal((await loadActiveStore())?.businessId, PALMART.tenantId, 'and it stays that way after a restart');
});

// ---------------------------------------------------------------------------------------------
// Opening, switching and the guard
// ---------------------------------------------------------------------------------------------

test('opening a shop makes it the active one, remembered, and the same after a restart', async () => {
  serve(allShops());
  const acme = await open('acme');
  const bobs = await open('bobs');
  assert.equal(await getActiveTenantId(), BOBS.tenantId);
  assert.deepEqual((await listRememberedStores()).map((s) => s.slug), ['bobs', 'acme']);

  configureStorage(null);
  assert.deepEqual(await loadActiveStore(), bobs);
  assert.deepEqual(await loadStoreById(ACME.tenantId), acme);
  assert.equal(await loadStoreById('nobody'), null);
  assert.equal(await loadStoreById('bad id'), null);
});

test('only five shops are remembered; the data of the one that falls off is kept', async () => {
  const routes: unknown[] = [];
  const idOf = (i: number) => `00000000-0000-4000-8000-00000000000${i}`;
  for (let i = 1; i <= 6; i += 1) {
    routes.push([mobileUrl(`shop${i}`), { status: 200, body: mobileBody({ ...ACME, tenantId: idOf(i), slug: `shop${i}`, host: `shop${i}.kiosk.ke`, name: `Shop ${i}` }) }]);
  }
  serve(routes);
  for (let i = 1; i <= 6; i += 1) {
    await open(`shop${i}`);
    await writeTenantValue('tabPhone', `07000000${i}`);
  }
  assert.deepEqual((await listRememberedStores()).map((s) => s.slug), ['shop6', 'shop5', 'shop4', 'shop3', 'shop2']);
  assert.equal(await readTenantValue('tabPhone', idOf(1)), '070000001');
});

test('a shop that cannot be opened leaves the active one alone', async () => {
  serve([
    ...allShops(),
    [mobileUrl('gone'), { status: 404, body: {} }],
    [mobileUrl('shut'), { status: 200, body: mobileBody({ ...BOBS, slug: 'shut' }, { tenantStatus: 'SUSPENDED' }) }],
  ]);
  await open('acme');
  assert.deepEqual(await openStore('gone', API, { audience: 'staff' }), { kind: 'not_found' });
  assert.equal((await openStore('shut', API, { audience: 'staff' })).kind, 'unavailable');
  net?.restore();
  net = offlineNetwork() as Handle;
  assert.deepEqual(await openStore('bobs', API, { audience: 'staff' }), { kind: 'offline' });
  assert.equal(await getActiveTenantId(), ACME.tenantId);
});

test('the switch guard: unsent sales block it, keepUnsent goes through and keeps the session', async () => {
  serve(allShops());
  countQueuesAsUnsent();
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  await queue(ACME.tenantId, [{ id: 'a1' }, { id: 'a2' }]);

  const blocked = await switchStore(null);
  assert.deepEqual(blocked, { kind: 'blocked', reason: 'unsent_sales', unsent: { total: 2, needsAttention: 0 } });
  assert.equal(await getActiveTenantId(), ACME.tenantId);
  assert.equal(await getAccessToken(), 'A-access');

  assert.deepEqual(await switchStore(null, { keepUnsent: true }), { kind: 'switched', store: null });
  assert.equal(await loadActiveStore(), null);
  assert.equal(await getAccessToken(ACME.tenantId), 'A-access', 'the session stays so the queue can still be sent');
  assert.equal(queued(ACME.tenantId).length, 2);
});

test('leaving a shop with nothing unsent ends its session, and only its session', async () => {
  serve(allShops());
  countQueuesAsUnsent();
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  await writeTenantValue('tabPhone', '0711111111');
  const till = await getOrCreateTillDeviceId();

  assert.deepEqual(await switchStore(null), { kind: 'switched', store: null });
  assert.equal(await getAccessToken(ACME.tenantId), null);
  assert.equal(await readTenantSecret('refreshToken', ACME.tenantId), null);
  assert.equal(await readTenantValue('tabPhone', ACME.tenantId), '0711111111');
  assert.equal(await getOrCreateTillDeviceId(ACME.tenantId), till);
});

test('switching to the shop that is already active changes nothing and asks nothing', async () => {
  serve(allShops());
  countQueuesAsUnsent();
  const acme = await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  await queue(ACME.tenantId, [{ id: 'a1' }]);
  assert.deepEqual(await switchStore(acme), { kind: 'switched', store: acme });
  assert.equal(await getAccessToken(), 'A-access');
});

test('a queue that cannot be read does not trap the person in a shop', async () => {
  serve(allShops());
  registerUnsentProbe(async () => {
    throw new Error('queue unreadable');
  });
  await open('acme');
  assert.deepEqual(await switchStore(null), { kind: 'switched', store: null });
});

test('forgetting a shop removes its session, till id, profile and hints, and keeps its unsent sales unless told otherwise', async () => {
  serve(allShops());
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  await getOrCreateTillDeviceId();
  await writeTenantValue('profile', '{}');
  await queue(ACME.tenantId, [{ id: 'a1' }]);

  await forgetStore(ACME.tenantId);
  assert.equal(await loadActiveStore(), null, 'it was the active shop');
  assert.deepEqual(await listRememberedStores(), []);
  assert.equal([...secureStore.__store.keys()].some((k) => k.includes(ACME.tenantId)), false);
  assert.equal(asyncStore.__store.has(K.plainKey(ACME.tenantId, 'profile')), false);
  assert.equal(queued(ACME.tenantId).length, 1);

  await forgetStore(ACME.tenantId, { dropOutbox: true });
  assert.equal(asyncStore.__store.has(K.outboxKey(ACME.tenantId)), false);
});

test('a session cannot be stored for a shop that was forgotten while the request was out', async () => {
  serve(allShops());
  await open('acme');
  await forgetStore(ACME.tenantId);
  await storeTokens({ accessToken: 'late', refreshToken: 'late' }, ACME.tenantId);
  assert.equal([...secureStore.__store.keys()].some((k) => k.includes('accessToken')), false);
  await assert.rejects(storeTokens({ accessToken: 'x', refreshToken: 'y' }), /Select a store first/);
});

test('clearing the active shop keeps its data and forgets only the pointer', async () => {
  serve(allShops());
  await open('acme');
  await writeTenantValue('tabPhone', '0711111111');
  await clearActiveStore();
  assert.equal(await loadActiveStore(), null);
  assert.equal(await readTenantValue('tabPhone', ACME.tenantId), '0711111111');
  assert.deepEqual((await listRememberedStores()).map((s) => s.slug), ['acme']);
});

test('with no active shop, per-shop data reads as empty and refuses writes instead of landing nowhere', async () => {
  assert.equal(await readTenantValue('profile'), null);
  assert.equal(await writeTenantValue('profile', 'x'), false);
  assert.equal(await writeTenantSecret('deviceSecret', 'x'), false);
  assert.equal(await getOrCreateTillDeviceId(), '');
  assert.equal(secureStore.__store.size, 0);
});

test('listeners hear about real changes only, and one that throws does not stop the rest', async () => {
  serve(allShops());
  const heard: string[] = [];
  const stop = subscribeActiveStore(() => {
    throw new Error('listener bug');
  });
  const stopSecond = subscribeActiveStore((store) => heard.push(store?.slug ?? 'none'));

  await open('acme');
  await open('acme');
  await open('bobs', true);
  await clearActiveStore();
  await clearActiveStore();
  assert.deepEqual(heard, ['acme', 'bobs', 'none']);

  stop();
  stopSecond();
  await open('acme');
  assert.deepEqual(heard, ['acme', 'bobs', 'none']);
});

test('asking the server again about the shop that is already open is not a change anyone should redraw for', async () => {
  serve(allShops());
  const realIso = Date.prototype.toISOString;
  let second = 0;
  Date.prototype.toISOString = function toISOString(this: Date) {
    second += 1; // every lookup is stamped with a different time, however fast the phone is
    return realIso.call(new Date(Date.UTC(2026, 10, 22, 12, 0, second)));
  };
  try {
    const heard: string[] = [];
    const stop = subscribeActiveStore((store) => heard.push(store?.slug ?? 'none'));
    await open('acme');
    const first = await loadActiveStore();
    await open('acme');
    await revalidateActive(API, { audience: 'staff' });
    const later = await loadActiveStore();
    stop();
    assert.deepEqual(heard, ['acme'], 'same shop, same look: nothing to redraw');
    assert.ok(first && later && later.fetchedAt > first.fetchedAt, 'but the time it was last confirmed is kept up to date');
  } finally {
    Date.prototype.toISOString = realIso;
  }
});

test('two shops opened at once end with a consistent record', async () => {
  serve(allShops());
  await Promise.all([
    openStore('acme', API, { audience: 'staff', keepUnsent: true }),
    openStore('bobs', API, { audience: 'staff', keepUnsent: true }),
  ]);
  const active = await getActiveTenantId();
  assert.ok(active === ACME.tenantId || active === BOBS.tenantId);
  configureStorage(null);
  assert.equal(await getActiveTenantId(), active, 'the stored pointer agrees with what was in memory');
});

// ---------------------------------------------------------------------------------------------
// Revalidation and boot
// ---------------------------------------------------------------------------------------------

test('revalidating keeps what the server now says, tells listeners, and survives a restart', async () => {
  serve(allShops());
  await open('acme');
  serve([
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { displayName: 'Acme Supermarket', branding: { primaryColor: '#ff0000' }, tenantHost: 'somewhere.else.ke' }) }],
  ]);
  const heard: string[] = [];
  subscribeActiveStore((store) => heard.push(store?.displayName ?? 'none'));

  const result = await revalidateActive(API, { audience: 'staff' });
  assert.equal(result?.kind, 'found');
  assert.deepEqual(heard, ['Acme Supermarket']);

  configureStorage(null);
  const store = await loadActiveStore();
  assert.equal(store?.displayName, 'Acme Supermarket');
  assert.deepEqual(store?.branding, { primaryColor: '#ff0000' });
  assert.equal(store?.host, 'acme.kiosk.ke', 'the host that worked from this phone is kept');
});

test('a shop that was suspended is recorded as suspended and stays the active one', async () => {
  serve(allShops());
  await open('acme');
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { tenantStatus: 'SUSPENDED' }) }]]);
  const result = await revalidateActive(API, { audience: 'staff' });
  assert.equal(result?.kind === 'unavailable' && result.reason, 'suspended');
  configureStorage(null);
  const store = await loadActiveStore();
  assert.equal(store?.slug, 'acme');
  assert.equal(store?.status, 'SUSPENDED');
});

test('a failed or rate-limited check changes nothing', async () => {
  serve(allShops());
  const before = await open('acme');
  for (const [status, kind] of [[500, 'offline'], [429, 'rate_limited'], [404, 'not_found']] as const) {
    serve([[/./, { status, body: {} }]]);
    const result = await revalidateActive(API, { audience: 'staff' });
    assert.equal(result?.kind, kind, String(status));
    assert.deepEqual(await loadActiveStore(), before);
  }
  net?.restore();
  net = offlineNetwork() as Handle;
  assert.deepEqual(await revalidateActive(API, { audience: 'staff' }), { kind: 'offline' });
  assert.deepEqual(await loadActiveStore(), before);
});

test('with no active shop there is nothing to revalidate', async () => {
  assert.equal(await revalidateActive(API, { audience: 'staff' }), null);
});

test('an address that now belongs to a different business is not applied to the shop on file', async () => {
  serve(allShops());
  const before = await open('acme');
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody({ ...BOBS, slug: 'acme', host: 'acme.kiosk.ke' }) }]]);
  assert.deepEqual(await revalidateActive(API, { audience: 'staff' }), { kind: 'not_found' });
  assert.deepEqual(await loadActiveStore(), before);
});

test('an answer that arrives after the person switched shops is not applied to the new one', async () => {
  serve(allShops());
  await open('acme');
  await open('bobs');
  await open('acme');
  const bobs = await loadStoreById(BOBS.tenantId);
  assert.ok(bobs);
  serve([
    [
      mobileUrl('acme'),
      async () => {
        await switchStore(bobs!, { keepUnsent: true });
        return { status: 200, body: mobileBody(ACME, { displayName: 'Too Late' }) };
      },
    ],
  ]);
  await revalidateActive(API, { audience: 'staff' });
  assert.equal(await getActiveTenantId(), BOBS.tenantId);
  assert.equal((await loadStoreById(ACME.tenantId))?.displayName, ACME.name, 'the stale answer was dropped');
});

test('a build for any shop with nothing saved shows the picker; one made for a shop finds its shop', async () => {
  serve(allShops());
  assert.deepEqual(await bootstrapStore(API), { kind: 'picker' });
  assert.equal(await bootstrapTenant(API), null);

  setBuild(PALMART_BUILD);
  configureStorage(null);
  serve([[hostUrl('palmart.co.ke'), { status: 200, body: hostBody(PALMART) }]]);
  const boot = await bootstrapStore(API, { audience: 'staff' });
  assert.equal(boot.kind, 'ready');
  if (boot.kind === 'ready') {
    assert.equal(boot.source, 'server');
    assert.equal(boot.store.host, 'palmart.co.ke');
    assert.equal(boot.store.businessId, PALMART.tenantId);
  }
  configureStorage(null);
  net?.restore();
  net = offlineNetwork() as Handle;
  const again = await bootstrapStore(API, { audience: 'staff' });
  assert.equal(again.kind === 'ready' && again.source, 'device');
});

test('a build made for one shop that cannot reach it on first launch says so instead of showing a picker', async () => {
  setBuild(PALMART_BUILD);
  configureStorage(null);
  net = offlineNetwork() as Handle;
  assert.deepEqual(await bootstrapStore(API), { kind: 'offline' });
  await assert.rejects(
    bootstrapTenant(API),
    (error: unknown) => error instanceof StoreLookupError && error.result.kind === 'offline' && /connection/.test(error.message),
  );

  serve([[hostUrl('palmart.co.ke'), { status: 200, body: hostBody(PALMART, { status: 'SUSPENDED' }) }]]);
  assert.equal((await bootstrapStore(API)).kind, 'unavailable');
});

test('a shopper build will not open a shop with its storefront off; the staff build will', async () => {
  setBuild(PALMART_BUILD);
  configureStorage(null);
  serve([[hostUrl('palmart.co.ke'), { status: 200, body: hostBody(PALMART, { storefrontEnabled: false }) }]]);
  assert.equal((await bootstrapStore(API, { audience: 'shopper' })).kind, 'unavailable');
  assert.equal(await getActiveTenantId(), null);
  assert.equal((await bootstrapStore(API, { audience: 'staff' })).kind, 'ready');
});

test("a build made for one shop that finds another saved opens its own and leaves the other's data alone", async () => {
  serve(allShops());
  await open('acme');
  await writeTenantValue('tabPhone', '0711111111');

  setBuild(PALMART_BUILD);
  configureStorage(null);
  serve([[hostUrl('palmart.co.ke'), { status: 200, body: hostBody(PALMART) }]]);
  const boot = await bootstrapStore(API, { audience: 'staff' });
  assert.equal(boot.kind === 'ready' && boot.store.slug, 'palmart');
  assert.equal(await readTenantValue('tabPhone', ACME.tenantId), '0711111111');
});

// ---------------------------------------------------------------------------------------------
// Requests and sessions stay with their shop
// ---------------------------------------------------------------------------------------------

const ping = `${API}/api/v1/ping`;

function pings(handle: Handle) {
  return handle.calls.filter((call) => call.url === ping);
}

test("requests carry the active shop's headers, session and till id; a pinned client stays with its shop", async () => {
  const handle = serve([...allShops(), [ping, { status: 200, body: { ok: true } }]]);
  countQueuesAsUnsent();
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  const tillA = await getOrCreateTillDeviceId();
  await queue(ACME.tenantId, [{ id: 'a1' }]); // so A's session survives leaving it
  const pinned = createApiClient({ baseURL: API, tenantId: ACME.tenantId });
  const following = createApiClient({ baseURL: API });

  await following.get('/api/v1/ping');
  await open('bobs', true);
  await storeTokens({ accessToken: 'B-access', refreshToken: 'B-refresh' });
  const tillB = await getOrCreateTillDeviceId();
  await following.get('/api/v1/ping');
  await pinned.get('/api/v1/ping');

  const [first, second, third] = pings(handle);
  assert.deepEqual(
    [first?.headers['X-Tenant-Id'], first?.headers['X-Tenant-Host'], first?.headers['Authorization'], first?.headers['X-Till-Device-Id']],
    [ACME.tenantId, 'acme.kiosk.ke', 'Bearer A-access', tillA],
  );
  assert.deepEqual(
    [second?.headers['X-Tenant-Id'], second?.headers['X-Tenant-Host'], second?.headers['Authorization'], second?.headers['X-Till-Device-Id']],
    [BOBS.tenantId, 'bobs.kiosk.ke', 'Bearer B-access', tillB],
  );
  assert.deepEqual(
    [third?.headers['X-Tenant-Id'], third?.headers['Authorization'], third?.headers['X-Till-Device-Id']],
    [ACME.tenantId, 'Bearer A-access', tillA],
    'a client pinned to A keeps talking to A while B is active',
  );
});

test('a request with no shop carries no session and no till id', async () => {
  const handle = serve([[ping, { status: 200, body: {} }]]);
  await createApiClient({ baseURL: API }).get('/api/v1/ping');
  const headers = pings(handle)[0]?.headers ?? {};
  assert.equal(headers['Authorization'], undefined);
  assert.equal(headers['X-Till-Device-Id'], undefined);
  assert.equal(headers['X-Tenant-Id'], undefined);
});

test('a 401 refreshes the session of the shop the request was for and retries once, with the same idempotency key', async () => {
  let attempts = 0;
  const handle = serve([
    ...allShops(),
    [
      ping,
      (_url: string, init: { headers: Record<string, string> }) => {
        attempts += 1;
        return init.headers['Authorization'] === 'Bearer A-new' ? { status: 200, body: { ok: true } } : { status: 401, body: {} };
      },
    ],
    [`${API}/api/v1/auth/refresh`, { status: 200, body: { accessToken: 'A-new', refreshToken: 'A-refresh-new' } }],
  ]);
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });

  const result = await createApiClient({ baseURL: API }).post('/api/v1/ping', { x: 1 }, { idempotencyKey: 'sale-key-1' });
  assert.deepEqual(result, { ok: true });
  assert.equal(attempts, 2);
  assert.deepEqual(pings(handle).map((c) => c.headers['Idempotency-Key']), ['sale-key-1', 'sale-key-1']);

  const refresh = handle.calls.find((c) => c.url.endsWith('/auth/refresh'));
  assert.equal(JSON.parse(String(refresh?.body)).refreshToken, 'A-refresh');
  assert.equal(refresh?.headers['X-Tenant-Id'], ACME.tenantId);
  assert.equal(await getAccessToken(), 'A-new');
  assert.equal(await readTenantSecret('refreshToken'), 'A-refresh-new');
});

test('a retry after a refresh goes to the shop the request was for, even if the person switched shops meanwhile', async () => {
  const handle = serve([
    ...allShops(),
    [
      ping,
      (_url: string, init: { headers: Record<string, string> }) =>
        init.headers['Authorization'] === 'Bearer A-new' ? { status: 200, body: { ok: true } } : { status: 401, body: {} },
    ],
    [
      `${API}/api/v1/auth/refresh`,
      async () => {
        await switchStore((await loadStoreById(BOBS.tenantId))!, { keepUnsent: true });
        return { status: 200, body: { accessToken: 'A-new', refreshToken: 'A-refresh-new' } };
      },
    ],
  ]);
  countQueuesAsUnsent();
  await open('bobs');
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  await queue(ACME.tenantId, [{ id: 'a1' }]); // so A's session is still there after leaving it

  const result = await createApiClient({ baseURL: API }).post('/api/v1/ping', { x: 1 }, { idempotencyKey: 'sale-key-2' });
  assert.deepEqual(result, { ok: true });
  assert.equal(await getActiveTenantId(), BOBS.tenantId);
  const [first, retry] = pings(handle);
  assert.equal(first?.headers['X-Tenant-Id'], ACME.tenantId);
  assert.equal(retry?.headers['X-Tenant-Id'], ACME.tenantId);
  assert.equal(retry?.headers['Authorization'], 'Bearer A-new');
  assert.equal(retry?.headers['Idempotency-Key'], 'sale-key-2');
});

test('a refresh answer that arrives after the person signed out of that shop is thrown away', async () => {
  serve([
    ...allShops(),
    [
      `${API}/api/v1/auth/refresh`,
      async () => {
        await clearTokens(ACME.tenantId);
        return { status: 200, body: { accessToken: 'A-late', refreshToken: 'A-late-r' } };
      },
    ],
  ]);
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });

  assert.deepEqual(await refreshAccessToken(API), { kind: 'superseded' });
  assert.equal(await getAccessToken(ACME.tenantId), null, 'signing out stays signed out');
  assert.equal(await readTenantSecret('refreshToken', ACME.tenantId), null);
});

test('a refresh answer for an old session does not overwrite a newer sign-in', async () => {
  serve([
    ...allShops(),
    [
      `${API}/api/v1/auth/refresh`,
      async () => {
        await storeTokens({ accessToken: 'A-fresh', refreshToken: 'A-fresh-r' });
        return { status: 200, body: { accessToken: 'A-stale', refreshToken: 'A-stale-r' } };
      },
    ],
  ]);
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });

  assert.deepEqual(await refreshAccessToken(API), { kind: 'superseded' });
  assert.equal(await getAccessToken(), 'A-fresh');
  assert.equal(await readTenantSecret('refreshToken'), 'A-fresh-r');
});

test('a refusal of an old session does not end a newer sign-in', async () => {
  serve([
    ...allShops(),
    [
      `${API}/api/v1/auth/refresh`,
      async () => {
        await storeTokens({ accessToken: 'A-fresh', refreshToken: 'A-fresh-r' });
        return { status: 401, body: {} };
      },
    ],
  ]);
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });

  assert.deepEqual(await refreshAccessToken(API), { kind: 'superseded' });
  assert.equal(await getAccessToken(), 'A-fresh');
});

test('a request whose session was ended while it was out fails, and does not send the person to a sign-in for the shop they are in now', async () => {
  let failed = 0;
  serve([
    ...allShops(),
    [ping, { status: 401, body: {} }],
    [
      `${API}/api/v1/auth/refresh`,
      async () => {
        await switchStore((await loadStoreById(BOBS.tenantId))!); // nothing unsent, so A's session ends here
        return { status: 200, body: { accessToken: 'A-late', refreshToken: 'A-late-r' } };
      },
    ],
  ]);
  await open('bobs');
  await storeTokens({ accessToken: 'B-access', refreshToken: 'B-refresh' });
  await open('acme', true);
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });

  await assert.rejects(createApiClient({ baseURL: API, onAuthFailed: () => (failed += 1) }).get('/api/v1/ping'));
  assert.equal(failed, 0);
  assert.equal(await getAccessToken(ACME.tenantId), null);
  assert.equal(await getAccessToken(BOBS.tenantId), null, 'B was left earlier with nothing unsent, so its session had ended too');
});

test('a refused session sends the person to sign in only when it is the shop they are looking at', async () => {
  let failed = 0;
  serve([...allShops(), [ping, { status: 401, body: {} }], [`${API}/api/v1/auth/refresh`, { status: 401, body: {} }]]);
  countQueuesAsUnsent();
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  await queue(ACME.tenantId, [{ id: 'a1' }]);
  const pinned = createApiClient({ baseURL: API, tenantId: ACME.tenantId, onAuthFailed: () => (failed += 1) });

  await open('bobs', true);
  await storeTokens({ accessToken: 'B-access', refreshToken: 'B-refresh' });
  await assert.rejects(pinned.get('/api/v1/ping'));
  assert.equal(failed, 0, 'A is not the shop on screen');
  assert.equal(await getAccessToken(ACME.tenantId), null, 'but its session is over');
  assert.equal(await getAccessToken(BOBS.tenantId), 'B-access');

  await open('acme', true);
  await storeTokens({ accessToken: 'A-again', refreshToken: 'A-again-r' });
  await assert.rejects(pinned.get('/api/v1/ping'));
  assert.equal(failed, 1, 'now it is');
});

test('when the refresh is refused the session of that shop, and only that shop, is cleared', async () => {
  let failed = 0;
  serve([...allShops(), [ping, { status: 401, body: {} }], [`${API}/api/v1/auth/refresh`, { status: 401, body: {} }]]);
  countQueuesAsUnsent();
  await open('bobs');
  await storeTokens({ accessToken: 'B-access', refreshToken: 'B-refresh' });
  await queue(BOBS.tenantId, [{ id: 'b1' }]);
  await open('acme', true);
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });

  await assert.rejects(createApiClient({ baseURL: API, onAuthFailed: () => (failed += 1) }).get('/api/v1/ping'));
  assert.equal(failed, 1);
  assert.equal(await getAccessToken(ACME.tenantId), null);
  assert.equal(await getAccessToken(BOBS.tenantId), 'B-access');
});

test('a refresh that finishes after the person switched shops is stored for the shop it was for', async () => {
  serve([
    ...allShops(),
    [
      `${API}/api/v1/auth/refresh`,
      async () => {
        await switchStore((await loadStoreById(BOBS.tenantId))!, { keepUnsent: true });
        return { status: 200, body: { accessToken: 'A-new', refreshToken: 'A-refresh-new' } };
      },
    ],
  ]);
  countQueuesAsUnsent();
  await open('bobs');
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  await queue(ACME.tenantId, [{ id: 'a1' }]); // so A's session is still there after leaving it

  assert.deepEqual(await refreshAccessToken(API), { kind: 'ok' });
  assert.equal(await getActiveTenantId(), BOBS.tenantId);
  assert.equal(await getAccessToken(ACME.tenantId), 'A-new');
  assert.equal(await getAccessToken(BOBS.tenantId), null);
});

test('one refresh at a time per shop; two shops can refresh together', async () => {
  let calls = 0;
  serve([
    ...allShops(),
    [
      `${API}/api/v1/auth/refresh`,
      async () => {
        calls += 1;
        await settle();
        return { status: 200, body: { accessToken: `new-${calls}`, refreshToken: 'r' } };
      },
    ],
  ]);
  const bobs = await open('bobs');
  const acme = await open('acme', true);
  await storeTokens({ accessToken: 'A', refreshToken: 'A-r' }, ACME.tenantId);
  await storeTokens({ accessToken: 'B', refreshToken: 'B-r' }, BOBS.tenantId);

  await Promise.all([refreshAccessToken(API, acme), refreshAccessToken(API, acme), refreshAccessToken(API)]);
  assert.equal(calls, 1);
  calls = 0;
  await Promise.all([refreshAccessToken(API, acme), refreshAccessToken(API, bobs)]);
  assert.equal(calls, 2);
});

test('signing in stores the session under the shop the sign-in started in', async () => {
  serve([
    ...allShops(),
    [
      `${API}/api/v1/auth/login`,
      async (_url: string, init: { headers: Record<string, string> }) => {
        assert.equal(init.headers['X-Tenant-Id'], ACME.tenantId);
        await switchStore((await loadStoreById(BOBS.tenantId))!, { keepUnsent: true });
        return { status: 200, body: { accessToken: 'A-token', refreshToken: 'A-refresh' } };
      },
    ],
  ]);
  await open('bobs');
  await open('acme');
  await loginWithPassword(API, 'owner@acme.test', 'pw');
  assert.equal(await getAccessToken(ACME.tenantId), 'A-token');
  assert.equal(await getAccessToken(BOBS.tenantId), null);
});

test('signing in with no shop chosen says so', async () => {
  await assert.rejects(loginWithPassword(API, 'a@b.c', 'pw'), /Select a store first/);
});

test("signing out ends the active shop's session only", async () => {
  const handle = serve([...allShops(), [`${API}/api/v1/auth/logout`, { status: 204, body: {} }]]);
  countQueuesAsUnsent();
  await open('bobs');
  await storeTokens({ accessToken: 'B-access', refreshToken: 'B-refresh' });
  await queue(BOBS.tenantId, [{ id: 'b1' }]);
  await open('acme', true);
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });

  await logout(API);
  const call = handle.calls.find((c) => c.url.endsWith('/auth/logout'));
  assert.equal(call?.headers['Authorization'], 'Bearer A-access');
  assert.equal(await getAccessToken(ACME.tenantId), null);
  assert.equal(await getAccessToken(BOBS.tenantId), 'B-access');
});

// ---------------------------------------------------------------------------------------------
// The older entry points keep working, with the new rules
// ---------------------------------------------------------------------------------------------

test('resolveTenant and loadTenant still work for a screen that only catches errors', async () => {
  serve([...allShops(), [mobileUrl('nope'), { status: 404, body: {} }]]);
  const store = await resolveTenant('acme', API);
  assert.equal(store.businessId, ACME.tenantId);
  assert.deepEqual(await loadTenant(), store);

  await assert.rejects(
    resolveTenant('nope', API),
    (error: unknown) => error instanceof StoreLookupError && error.result.kind === 'not_found' && /"nope"/.test(error.message),
  );
  await clearTenant();
  assert.equal(await loadTenant(), null);
});

test('the old entry points are guarded too: a switch away from unsent sales is an error with a clear message', async () => {
  serve(allShops());
  countQueuesAsUnsent();
  await open('acme');
  await queue(ACME.tenantId, [{ id: 'a1' }]);
  await assert.rejects(
    resolveTenant('bobs', API),
    (error: unknown) => error instanceof StoreSwitchBlockedError && /1 unsent sale/.test(error.message),
  );
});

test('a link that names a host is about that host, not the shop its first label might suggest', async () => {
  const handle = serve([
    [hostUrl('shop.example.co.ke'), { status: 200, body: hostBody(ACME) }],
    [mobileUrl('shop'), { status: 404, body: {} }],
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
  ]);
  const result = await resolveTenantFromDeepLink('https://shop.example.co.ke/shop', API, { audience: 'shopper' });
  assert.equal(result?.tenant.businessId, ACME.tenantId);
  assert.equal(result?.tenant.host, 'shop.example.co.ke');
  assert.equal(result?.intent, 'shop');
  assert.deepEqual(handle.calls.map((c) => c.url), [hostUrl('shop.example.co.ke')]);

  const bySlug = await resolveTenantFromDeepLink('kiosk://shop/bobs', API, { audience: 'shopper' });
  assert.equal(bySlug?.tenant.slug, 'bobs');
  assert.equal(await resolveTenantFromDeepLink('https://example.com/other', API, { audience: 'staff' }), null);
});

test('activating a shop directly is the same as opening it, minus the guard', async () => {
  serve(allShops());
  const acme = await open('acme');
  countQueuesAsUnsent();
  await queue(ACME.tenantId, [{ id: 'a1' }]);
  const bobs = await open('bobs', true);
  await activateStore(acme);
  assert.equal(await getActiveTenantId(), ACME.tenantId);
  await activateStore(bobs);
  assert.equal(await getActiveTenantId(), BOBS.tenantId);
});

// ---------------------------------------------------------------------------------------------
// Telling the app when the shop on screen becomes a different shop
// ---------------------------------------------------------------------------------------------

test('the store-id listener fires when the shop becomes a different one, not when the same shop looks different', async () => {
  serve(allShops());
  const ids: Array<string | null> = [];
  const looks: string[] = [];
  const stop = subscribeActiveStoreId((id) => ids.push(id));
  const stopLooks = subscribeActiveStore((store) => looks.push(store?.displayName ?? 'none'));

  await open('acme');
  await open('acme');
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { displayName: 'Acme Supermarket' }) }], [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }]]);
  await revalidateActive(API, { audience: 'staff' });
  assert.deepEqual(looks, ['Acme Mart', 'Acme Supermarket'], 'the rename is a real change for the screen');
  assert.deepEqual(ids, [ACME.tenantId], 'but it is still the same shop, so nothing held for it is wrong');

  await open('bobs', true);
  await clearActiveStore();
  assert.deepEqual(ids, [ACME.tenantId, BOBS.tenantId, null]);

  stop();
  stopLooks();
  await open('acme');
  assert.deepEqual(ids, [ACME.tenantId, BOBS.tenantId, null], 'a listener that stopped hears nothing more');
});

test('a shop carried over from the old layout settling on its real id is not a different shop', async () => {
  freshPhone(PALMART_BUILD);
  configureStorage(null);
  seedPalmartV1();
  net = offlineNetwork() as Handle;
  const boot = await bootstrapStore(API, { audience: 'staff' });
  assert.equal(boot.kind === 'ready' && boot.store.businessId, 'pending-palmart');
  await settle();

  const ids: Array<string | null> = [];
  const looks: string[] = [];
  const stop = subscribeActiveStoreId((id) => ids.push(id));
  const stopLooks = subscribeActiveStore((store) => looks.push(store?.businessId ?? 'none'));
  serve(allShops());
  await revalidateActive(API, { audience: 'staff' });
  assert.deepEqual(looks, [PALMART.tenantId], 'the screen is told the shop has its real id');
  assert.deepEqual(ids, [], 'but the session, cart and cached answers it holds are still this shop\'s');

  await open('acme', true);
  stop();
  stopLooks();
  assert.deepEqual(ids, [ACME.tenantId], 'a different shop is still announced');
});

test('a different shop that happens to reuse a verified shop\'s address is a different shop', async () => {
  serve(allShops());
  await open('acme');
  const ids: Array<string | null> = [];
  const stop = subscribeActiveStoreId((id) => ids.push(id));
  const impostor = { ...ACME, tenantId: 'dddddddd-0000-4000-8000-000000000009' };
  await activateStore({
    businessId: impostor.tenantId,
    slug: impostor.slug,
    host: impostor.host,
    displayName: impostor.name,
    status: 'ACTIVE',
    storefrontEnabled: true,
    branding: {},
    fetchedAt: new Date().toISOString(),
  } as Parameters<typeof activateStore>[0]);
  stop();
  assert.deepEqual(ids, [impostor.tenantId]);
});

test('a listener added while a shop is already open stays quiet about that shop and hears the next one', async () => {
  serve(allShops());
  await open('acme');
  const ids: Array<string | null> = [];
  const stop = subscribeActiveStoreId((id) => ids.push(id));
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { displayName: 'Acme Supermarket' }) }], [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }]]);
  await revalidateActive(API, { audience: 'staff' });
  assert.deepEqual(ids, [], 'the shop it joined on is not news');
  await open('bobs', true);
  stop();
  assert.deepEqual(ids, [BOBS.tenantId]);
});

test('leaving a carried-over shop for a different one is announced, even before its real id was known', async () => {
  freshPhone(PALMART_BUILD);
  configureStorage(null);
  seedPalmartV1();
  net = offlineNetwork() as Handle;
  const boot = await bootstrapStore(API, { audience: 'staff' });
  assert.equal(boot.kind === 'ready' && boot.store.businessId, 'pending-palmart');
  await settle();

  const ids: Array<string | null> = [];
  const stop = subscribeActiveStoreId((id) => ids.push(id));
  serve(allShops());
  await open('acme', true);
  stop();
  assert.deepEqual(ids, [ACME.tenantId]);
});

test('a listener added before any shop has loaded hears the first shop that opens', async () => {
  serve(allShops());
  const ids: Array<string | null> = [];
  const stop = subscribeActiveStoreId((id) => ids.push(id));
  await open('bobs');
  stop();
  assert.deepEqual(ids, [BOBS.tenantId]);
});

// ---------------------------------------------------------------------------------------------
// Links that point at another shop while this one still has sales to send
// ---------------------------------------------------------------------------------------------

test('a link to another shop waits while the shop on the phone has unsent sales, and goes through once the person agrees', async () => {
  serve(allShops());
  countQueuesAsUnsent();
  await open('acme');
  await storeTokens({ accessToken: 'A-access', refreshToken: 'A-refresh' });
  await queue(ACME.tenantId, [{ id: 'a1' }]);

  await assert.rejects(
    resolveTenantFromDeepLink('kiosk://shop/bobs', API, { audience: 'staff' }),
    (error: unknown) => error instanceof StoreSwitchBlockedError && error.unsent.total === 1,
  );
  assert.equal(await getActiveTenantId(), ACME.tenantId, 'nothing changed while it waited');
  assert.equal(await getAccessToken(), 'A-access');

  const result = await resolveTenantFromDeepLink('kiosk://shop/bobs', API, { audience: 'staff', keepUnsent: true });
  assert.equal(result?.tenant.businessId, BOBS.tenantId);
  assert.equal(await getActiveTenantId(), BOBS.tenantId);
  assert.equal(queued(ACME.tenantId).length, 1, 'the sale still waits in its own shop');
  assert.equal(await getAccessToken(ACME.tenantId), 'A-access', 'with the session it needs to be sent');
});

test('a link to the shop that is already open never waits, even with unsent sales', async () => {
  serve(allShops());
  countQueuesAsUnsent();
  await open('acme');
  await queue(ACME.tenantId, [{ id: 'a1' }]);
  const result = await resolveTenantFromDeepLink('kiosk://shop/acme', API, { audience: 'staff' });
  assert.equal(result?.tenant.businessId, ACME.tenantId);
});
