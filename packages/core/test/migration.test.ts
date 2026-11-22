import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore, freshPhone, reinstall, secureStore, setBuild } from './support/world.mjs';
import { configureStorage, plain, secureIndexKeys } from '../src/storage';
import { adoptProvisional, ensureStorageReady, removeNamespace } from '../src/storage-schema';
import {
  CORRUPT_OUTBOX_KEY,
  LEGACY_PLAIN,
  LEGACY_SECURE,
  SCHEMA_KEY,
  UNOWNED_ID,
  outboxKey,
  plainKey,
  secureKey,
} from '../src/storage-keys';
import {
  readPointer,
  readProvisional,
  readRecents,
  readSnapshot,
  writePointer,
  writeSnapshot,
  rememberTenant,
} from '../src/tenant-store';

const PALMART = { embeddedTenantSlug: 'palmart', isWhiteLabel: true };
const PENDING = 'pending-palmart';
const TRUE_ID = '0b1c6d2e-7f3a-4c58-9a1e-2d4f6a8b0c11';

const SALE_1 = { id: 'sale-1', method: 'POST', path: '/api/v1/sales', body: { total: 100 }, idempotencyKey: 'k1', retries: 0, createdAt: '2026-11-20T08:00:00.000Z' };
const SALE_2 = { id: 'sale-2', method: 'POST', path: '/api/v1/sales', body: { total: 250 }, idempotencyKey: 'k2', retries: 3, createdAt: '2026-11-20T09:00:00.000Z', lastError: 'timeout' };

const LEGACY_TENANT = {
  businessId: 'a-branch-id-the-old-code-guessed',
  slug: 'palmart',
  host: 'palmart.co.ke',
  displayName: 'Palmart Mini Mart',
  branding: { primaryColor: '#0a7d3b' },
};

/** What a phone running the last v1 build holds. */
function seedV1(options: { tenant?: object | null; outbox?: unknown[] | string | null; secrets?: boolean; hints?: boolean } = {}) {
  const { tenant = LEGACY_TENANT, outbox = [SALE_1, SALE_2], secrets = true, hints = true } = options;
  if (tenant) secureStore.__store.set(LEGACY_SECURE.tenant, JSON.stringify(tenant));
  if (secrets) {
    secureStore.__store.set(LEGACY_SECURE.accessToken, 'access-v1');
    secureStore.__store.set(LEGACY_SECURE.refreshToken, 'refresh-v1');
    secureStore.__store.set(LEGACY_SECURE.tillDeviceId, 'till-v1');
    secureStore.__store.set(LEGACY_SECURE.deviceSecret, 'device-secret-v1');
  }
  if (outbox !== null) {
    asyncStore.__store.set(LEGACY_PLAIN.outbox, typeof outbox === 'string' ? outbox : JSON.stringify(outbox));
  }
  if (hints) {
    asyncStore.__store.set(LEGACY_PLAIN.profile, JSON.stringify({ name: 'Wanjiru' }));
    asyncStore.__store.set(LEGACY_PLAIN.tabPhone, '0712345678');
    asyncStore.__store.set(LEGACY_PLAIN.airtimeRecipient, '0700111222');
    asyncStore.__store.set(LEGACY_PLAIN.airtimePayer, '0700333444');
  }
}

function dump(): string {
  return JSON.stringify({
    secure: [...secureStore.__store.entries()].sort(),
    plain: [...asyncStore.__store.entries()].sort(),
  });
}

function queue(tenantId: string): Array<Record<string, unknown>> {
  const raw = asyncStore.__store.get(outboxKey(tenantId));
  return raw ? JSON.parse(raw) : [];
}

/** Starts a new process: in-memory state gone, stored data kept. */
function restart() {
  secureStore.__setFault(null);
  asyncStore.__setFault(null);
  configureStorage(null);
}

beforeEach(() => {
  freshPhone(PALMART);
  configureStorage(null);
});

test('a Palmart upgrade keeps the shop, the session, the till id and every queued sale', async () => {
  seedV1();
  await ensureStorageReady();

  assert.equal(asyncStore.__store.get(SCHEMA_KEY), '2');
  assert.equal(await readPointer(await plain()), PENDING);
  assert.deepEqual(await readProvisional(await plain()), { palmart: PENDING });

  const snapshot = await readSnapshot(await plain(), PENDING);
  assert.equal(snapshot?.slug, 'palmart');
  assert.equal(snapshot?.host, 'palmart.co.ke');
  assert.equal(snapshot?.displayName, 'Palmart Mini Mart');
  assert.deepEqual(snapshot?.branding, { primaryColor: '#0a7d3b' });
  assert.equal(snapshot?.businessId, PENDING);

  assert.equal(secureStore.__store.get(secureKey(PENDING, 'accessToken')), 'access-v1');
  assert.equal(secureStore.__store.get(secureKey(PENDING, 'refreshToken')), 'refresh-v1');
  assert.equal(secureStore.__store.get(secureKey(PENDING, 'tillDeviceId')), 'till-v1');
  assert.equal(secureStore.__store.get(secureKey(PENDING, 'deviceSecret')), 'device-secret-v1');
  assert.equal(asyncStore.__store.get(plainKey(PENDING, 'profile')), JSON.stringify({ name: 'Wanjiru' }));
  assert.equal(asyncStore.__store.get(plainKey(PENDING, 'tabPhone')), '0712345678');

  // Queued sales: same ids, same order, same payloads, now tagged with the shop they belong to.
  assert.deepEqual(queue(PENDING), [
    { ...SALE_1, tenantId: PENDING },
    { ...SALE_2, tenantId: PENDING },
  ]);

  // Nothing of the old layout is left behind.
  for (const key of Object.values(LEGACY_SECURE)) assert.equal(secureStore.__store.has(key), false, key);
  for (const key of Object.values(LEGACY_PLAIN)) assert.equal(asyncStore.__store.has(key), false, key);

  // Every secure key written is indexed, so a later reinstall can find and purge them.
  const indexed = await secureIndexKeys();
  for (const key of secureStore.__store.keys()) {
    if (key !== 'kiosk.v2.secureIndex') assert.ok(indexed.includes(key), key);
  }
});

test('migrating twice, or after a restart, changes nothing', async () => {
  seedV1();
  await ensureStorageReady();
  const once = dump();
  await ensureStorageReady();
  restart();
  await ensureStorageReady();
  assert.equal(dump(), once);
});

test('a crash at any single step loses nothing and the next launch finishes the job', async () => {
  seedV1();
  await ensureStorageReady();
  const golden = dump();

  // Count the storage operations of one clean run.
  freshPhone(PALMART);
  restart();
  seedV1();
  let total = 0;
  const counter = () => {
    total += 1;
  };
  secureStore.__setFault(counter);
  asyncStore.__setFault(counter);
  await ensureStorageReady();
  assert.ok(total > 20, `expected a real migration, saw ${total} operations`);

  for (let crashAt = 1; crashAt <= total; crashAt += 1) {
    freshPhone(PALMART);
    restart();
    seedV1();
    let seen = 0;
    const crash = () => {
      seen += 1;
      if (seen === crashAt) throw new Error('process killed');
    };
    secureStore.__setFault(crash);
    asyncStore.__setFault(crash);
    await assert.rejects(ensureStorageReady(), /process killed/, `crash at operation ${crashAt}`);

    restart();
    await ensureStorageReady();
    assert.equal(dump(), golden, `state after a crash at operation ${crashAt} and a restart`);
  }
});

test('a v1 install with no pointer in a white-label build still belongs to that shop', async () => {
  seedV1({ tenant: null });
  await ensureStorageReady();
  assert.equal(await readPointer(await plain()), null);
  assert.equal(queue(PENDING).length, 2);
  assert.equal(secureStore.__store.get(secureKey(PENDING, 'accessToken')), 'access-v1');
});

test('a pointer to a different shop than the build is for is not trusted with its tokens', async () => {
  seedV1({ tenant: { ...LEGACY_TENANT, slug: 'someone-else' } });
  await ensureStorageReady();
  assert.equal(await readPointer(await plain()), null);
  assert.deepEqual(await readProvisional(await plain()), {});
  // The tokens belong to a shop we cannot name: gone, not guessed. The queued sales are kept, parked, never sent.
  assert.equal([...secureStore.__store.keys()].some((k) => k.includes('accessToken')), false);
  assert.equal(queue(UNOWNED_ID).length, 2);
  assert.equal(queue(UNOWNED_ID)[0]?.tenantId, UNOWNED_ID);
  assert.equal(queue(PENDING).length, 0);
});

test('queued sales that belong to no known shop are parked, never attributed', async () => {
  freshPhone({});
  configureStorage(null);
  seedV1({ tenant: null, secrets: false, hints: false });
  await ensureStorageReady();
  assert.equal(queue(UNOWNED_ID).length, 2);
  assert.equal(asyncStore.__store.has(LEGACY_PLAIN.outbox), false);
  assert.equal(await readPointer(await plain()), null);
});

test('a v1 outbox that is not valid JSON is kept as found', async () => {
  seedV1({ outbox: '[{"id":"sale-1", oops' });
  await ensureStorageReady();
  assert.equal(asyncStore.__store.get(CORRUPT_OUTBOX_KEY), '[{"id":"sale-1", oops');
  assert.equal(asyncStore.__store.get(SCHEMA_KEY), '2');
});

test('an empty v1 outbox is not mistaken for a corrupt one', async () => {
  seedV1({ outbox: [] });
  await ensureStorageReady();
  assert.equal(asyncStore.__store.has(CORRUPT_OUTBOX_KEY), false);
});

test('v1 secrets in a build that serves any shop are leftovers, and are deleted', async () => {
  freshPhone({});
  configureStorage(null);
  seedV1({ outbox: null, hints: false });
  await ensureStorageReady();
  assert.equal(secureStore.__store.size, 0);
  assert.equal(asyncStore.__store.get(SCHEMA_KEY), '2');
  assert.equal(await readPointer(await plain()), null);
});

test('a reinstall on iOS keeps the keychain; nothing in it comes back to life', async () => {
  const { securePut } = await import('../src/storage');
  const store = await plain();
  // A v2 install that was signed in to a shop.
  await ensureStorageReady();
  await securePut(secureKey(TRUE_ID, 'accessToken'), 'stale-token');
  await securePut(secureKey(TRUE_ID, 'tillDeviceId'), 'stale-till');
  await store.set(plainKey(TRUE_ID, 'profile'), '{}');

  // The app is deleted and installed again: app data is gone, the keychain is not.
  reinstall();
  restart();
  assert.ok(secureStore.__store.has(secureKey(TRUE_ID, 'accessToken')));
  await ensureStorageReady();

  assert.equal(secureStore.__store.size, 0);
  assert.equal(asyncStore.__store.get(SCHEMA_KEY), '2');
});

test('a fresh install on a phone that never had the app writes only the marker', async () => {
  freshPhone({});
  configureStorage(null);
  await ensureStorageReady();
  assert.deepEqual([...asyncStore.__store.keys()], [SCHEMA_KEY]);
  assert.equal(secureStore.__store.size, 0);
});

test('data written by a newer build is left alone', async () => {
  asyncStore.__store.set(SCHEMA_KEY, '3');
  seedV1();
  const before = dump();
  await ensureStorageReady();
  assert.equal(dump(), before);
});

test('a keychain that refuses to delete stops the launch instead of leaving stale tokens in use', async () => {
  const { securePut } = await import('../src/storage');
  freshPhone({});
  configureStorage(null);
  await securePut(secureKey(TRUE_ID, 'accessToken'), 'stale');
  asyncStore.__wipe();
  restart();
  secureStore.__setFault((op: string, key: string) => {
    if (op === 'delete' && key === secureKey(TRUE_ID, 'accessToken')) throw new Error('keychain busy');
  });
  await assert.rejects(ensureStorageReady(), /previous install/);
  assert.equal(asyncStore.__store.has(SCHEMA_KEY), false);
  restart();
  await ensureStorageReady();
  assert.equal(secureStore.__store.size, 0);
});

test('the first confirmed id moves a carried-over shop to its real namespace', async () => {
  seedV1();
  await ensureStorageReady();
  const store = await plain();

  // The server confirms the shop. A queue and a hint already exist under the real id: the real id wins.
  await store.set(plainKey(TRUE_ID, 'tabPhone'), '0799000111');
  await store.set(outboxKey(TRUE_ID), JSON.stringify([{ ...SALE_1, tenantId: TRUE_ID, body: { total: 999 } }]));
  await writeSnapshot(store, { businessId: TRUE_ID, slug: 'palmart', host: 'palmart.co.ke', displayName: 'Palmart', branding: {}, fetchedAt: '2026-11-22T10:00:00.000Z' });

  assert.equal(await adoptProvisional('palmart', TRUE_ID), true);

  assert.equal(await readPointer(store), TRUE_ID);
  assert.deepEqual(await readRecents(store), [TRUE_ID]);
  assert.deepEqual(await readProvisional(store), {});
  assert.equal(await readSnapshot(store, PENDING), null);

  assert.equal(secureStore.__store.get(secureKey(TRUE_ID, 'accessToken')), 'access-v1');
  assert.equal(secureStore.__store.get(secureKey(TRUE_ID, 'tillDeviceId')), 'till-v1');
  assert.equal(asyncStore.__store.get(plainKey(TRUE_ID, 'tabPhone')), '0799000111');
  assert.equal(asyncStore.__store.get(plainKey(TRUE_ID, 'profile')), JSON.stringify({ name: 'Wanjiru' }));

  const moved = queue(TRUE_ID);
  assert.deepEqual(moved.map((item) => item.id), ['sale-1', 'sale-2']);
  assert.ok(moved.every((item) => item.tenantId === TRUE_ID));
  assert.deepEqual(moved[0]?.body, { total: 999 }, 'where both have sale-1, the real namespace keeps its own copy');

  for (const key of secureStore.__store.keys()) assert.equal(key.includes(PENDING), false, key);
  for (const key of asyncStore.__store.keys()) assert.equal(key.includes(PENDING), false, key);
});

test('a crash while adopting leaves the carried-over data findable and finishes on the next try', async () => {
  seedV1();
  await ensureStorageReady();
  const store = await plain();
  await writeSnapshot(store, { businessId: TRUE_ID, slug: 'palmart', host: 'palmart.co.ke', displayName: 'Palmart', branding: {}, fetchedAt: '2026-11-22T10:00:00.000Z' });
  const before = dump();

  let total = 0;
  const counter = () => {
    total += 1;
  };
  secureStore.__setFault(counter);
  asyncStore.__setFault(counter);
  await adoptProvisional('palmart', TRUE_ID);
  const golden = dump();
  assert.ok(total > 10);

  for (let crashAt = 1; crashAt <= total; crashAt += 1) {
    freshPhone(PALMART);
    restart();
    seedV1();
    await ensureStorageReady();
    const again = await plain();
    await writeSnapshot(again, { businessId: TRUE_ID, slug: 'palmart', host: 'palmart.co.ke', displayName: 'Palmart', branding: {}, fetchedAt: '2026-11-22T10:00:00.000Z' });
    assert.equal(dump(), before);

    let seen = 0;
    const crash = () => {
      seen += 1;
      if (seen === crashAt) throw new Error('process killed');
    };
    secureStore.__setFault(crash);
    asyncStore.__setFault(crash);
    await assert.rejects(adoptProvisional('palmart', TRUE_ID), /process killed/, `crash at ${crashAt}`);

    restart();
    await adoptProvisional('palmart', TRUE_ID);
    assert.equal(dump(), golden, `after a crash at operation ${crashAt}`);
  }
});

test('removing a shop deletes its data and keeps its unsent sales unless told otherwise', async () => {
  seedV1();
  await ensureStorageReady();
  const store = await plain();
  await rememberTenant(store, PENDING);

  await removeNamespace(PENDING);
  assert.equal([...secureStore.__store.keys()].some((k) => k.includes(PENDING)), false);
  assert.equal(asyncStore.__store.has(plainKey(PENDING, 'profile')), false);
  assert.equal(await readSnapshot(store, PENDING), null);
  assert.deepEqual(await readRecents(store), []);
  assert.deepEqual(await readProvisional(store), {});
  assert.equal(queue(PENDING).length, 2, 'unsent sales survive');

  await removeNamespace(PENDING, { dropOutbox: true });
  assert.equal(asyncStore.__store.has(outboxKey(PENDING)), false);
});

test('writing a pointer for a shop that has no record is harmless to read back', async () => {
  const store = await plain();
  await writePointer(store, TRUE_ID);
  assert.equal(await readSnapshot(store, TRUE_ID), null);
});
