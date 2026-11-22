import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore, freshPhone, secureStore } from './support/world.mjs';
import {
  configureStorage,
  plain,
  purgeSecureIndex,
  readJson,
  secureGet,
  secureIndexKeys,
  securePut,
  secureRemove,
  writeJson,
} from '../src/storage';
import {
  ACTIVE_TENANT_KEY,
  RECENT_LIMIT,
  assertTenantId,
  outboxKey,
  plainKey,
  secureKey,
  snapshotKey,
  SECURE_FIELDS,
  PLAIN_FIELDS,
} from '../src/storage-keys';
import {
  readPointer,
  readProvisional,
  readRecents,
  readSnapshot,
  rememberTenant,
  writePointer,
  writeProvisional,
  writeSnapshot,
} from '../src/tenant-store';

const SECURE_STORE_KEY = /^[\w.-]+$/;
const ID_A = '0b1c6d2e-7f3a-4c58-9a1e-2d4f6a8b0c11';
const ID_B = '7e9f2a40-1b3c-4d5e-8f60-a1b2c3d4e5f6';

beforeEach(() => {
  freshPhone();
  configureStorage(null);
});

test('tenant ids that cannot be a storage key are refused', () => {
  assert.equal(assertTenantId(ID_A), ID_A);
  assert.equal(assertTenantId('pending-acme'), 'pending-acme');
  for (const bad of ['', 'a/b', 'a b', 'a:b', '../x', 'activeTenant', 'secureIndex', 'x'.repeat(81)]) {
    assert.throws(() => assertTenantId(bad), /Invalid tenant id/, JSON.stringify(bad));
  }
});

test('every key built for a tenant is one SecureStore accepts', () => {
  for (const field of SECURE_FIELDS) {
    assert.match(secureKey(ID_A, field), SECURE_STORE_KEY);
  }
  for (const field of PLAIN_FIELDS) {
    assert.match(plainKey(ID_A, field), SECURE_STORE_KEY);
  }
  assert.match(snapshotKey(ID_A), SECURE_STORE_KEY);
});

test('two tenants never share a key', () => {
  const keys = [ID_A, ID_B].flatMap((id) => [
    ...SECURE_FIELDS.map((f) => secureKey(id, f)),
    ...PLAIN_FIELDS.map((f) => plainKey(id, f)),
    snapshotKey(id),
    outboxKey(id),
  ]);
  assert.equal(new Set(keys).size, keys.length);
});

test('a secure write is indexed before the value lands, so a crash leaves nothing unreachable', async () => {
  const key = secureKey(ID_A, 'accessToken');
  secureStore.__setFault((op: string, k: string) => {
    if (op === 'set' && k === key) throw new Error('keychain write failed');
  });
  await assert.rejects(securePut(key, 'tok'), /keychain write failed/);
  secureStore.__setFault(null);
  assert.deepEqual(await secureIndexKeys(), [key]);
  assert.equal(await secureGet(key), null);
  assert.deepEqual(await purgeSecureIndex(), { removed: 1, failed: 0 });
  assert.deepEqual(await secureIndexKeys(), []);
});

test('removing a secure value drops it from the index, and a failed delete stays findable', async () => {
  const a = secureKey(ID_A, 'accessToken');
  const b = secureKey(ID_A, 'refreshToken');
  await securePut(a, '1');
  await securePut(b, '2');
  await secureRemove(a);
  assert.equal(await secureGet(a), null);
  assert.deepEqual(await secureIndexKeys(), [b]);

  secureStore.__setFault((op: string, k: string) => {
    if (op === 'delete' && k === b) throw new Error('keychain busy');
  });
  await assert.rejects(secureRemove(b), /keychain busy/);
  secureStore.__setFault(null);
  assert.deepEqual(await secureIndexKeys(), [b]);
  assert.equal(await secureGet(b), '2');
});

test('purge removes every indexed key and the index itself; a stuck key is kept for the next boot', async () => {
  const keys = SECURE_FIELDS.map((f) => secureKey(ID_A, f));
  for (const key of keys) await securePut(key, 'x');
  secureStore.__setFault((op: string, k: string) => {
    if (op === 'delete' && k === keys[1]) throw new Error('stuck');
  });
  assert.deepEqual(await purgeSecureIndex(), { removed: keys.length - 1, failed: 1 });
  assert.deepEqual(await secureIndexKeys(), [keys[1]]);
  secureStore.__setFault(null);
  assert.deepEqual(await purgeSecureIndex(), { removed: 1, failed: 0 });
  assert.equal(secureStore.__store.size, 0);
});

test('concurrent secure writes all end up in the index', async () => {
  const keys = Array.from({ length: 12 }, (_, i) => `kiosk.v2.t${i}.accessToken`);
  await Promise.all(keys.map((key) => securePut(key, 'v')));
  assert.deepEqual([...(await secureIndexKeys())].sort(), [...keys].sort());
});

test('a key SecureStore would refuse is rejected before it reaches the keychain', async () => {
  await assert.rejects(securePut('@kiosk/offline/outbox', 'x'), /Invalid secure storage key/);
  assert.equal(secureStore.__store.size, 0);
});

test('plain storage is AsyncStorage when the binary links it', async () => {
  const store = await plain();
  await store.set('kiosk.v2.probe.demo', 'hello');
  assert.equal(asyncStore.__store.get('kiosk.v2.probe.demo'), 'hello');
  assert.equal(secureStore.__store.size, 0);
});

test('plain storage falls back to SecureStore when AsyncStorage is not linked', async () => {
  asyncStore.__setMissing(true);
  configureStorage(null);
  const store = await plain();
  await store.set(ACTIVE_TENANT_KEY, ID_A);
  assert.equal(secureStore.__store.get(ACTIVE_TENANT_KEY), ID_A);
  // The migration looks for the old outbox here; a key SecureStore refuses reads as "nothing".
  assert.equal(await store.get('@kiosk/offline/outbox'), null);
  await store.remove('@kiosk/offline/outbox');
});

test('a corrupt JSON value reads as missing rather than throwing', async () => {
  const store = await plain();
  await store.set('kiosk.v2.demo', '{not json');
  assert.equal(await readJson(store, 'kiosk.v2.demo'), null);
  await writeJson(store, 'kiosk.v2.demo', { a: 1 });
  assert.deepEqual(await readJson(store, 'kiosk.v2.demo'), { a: 1 });
});

test('snapshots round-trip and a malformed one reads as missing', async () => {
  const store = await plain();
  const snapshot = {
    businessId: ID_A,
    slug: 'acme',
    host: 'acme.kiosk.ke',
    displayName: 'Acme',
    branding: { primary: '#123456' },
    status: 'ACTIVE',
    storefrontEnabled: true,
    fetchedAt: '2026-11-22T10:00:00.000Z',
  };
  await writeSnapshot(store, snapshot);
  assert.deepEqual(await readSnapshot(store, ID_A), snapshot);
  assert.equal(await readSnapshot(store, ID_B), null);
  await store.set(snapshotKey(ID_B), JSON.stringify({ businessId: ID_B }));
  assert.equal(await readSnapshot(store, ID_B), null);
});

test('the active pointer and the recent list', async () => {
  const store = await plain();
  assert.equal(await readPointer(store), null);
  await writePointer(store, ID_A);
  assert.equal(await readPointer(store), ID_A);
  await writePointer(store, null);
  assert.equal(await readPointer(store), null);

  for (let i = 0; i < RECENT_LIMIT + 2; i += 1) await rememberTenant(store, `t${i}`);
  const recents = await readRecents(store);
  assert.equal(recents.length, RECENT_LIMIT);
  assert.equal(recents[0], `t${RECENT_LIMIT + 1}`);
  await rememberTenant(store, `t${RECENT_LIMIT}`);
  assert.equal((await readRecents(store))[0], `t${RECENT_LIMIT}`);
  assert.equal(new Set(await readRecents(store)).size, RECENT_LIMIT);
});

test('the provisional map is removed when it empties', async () => {
  const store = await plain();
  await writeProvisional(store, { acme: 'pending-acme' });
  assert.deepEqual(await readProvisional(store), { acme: 'pending-acme' });
  await writeProvisional(store, {});
  assert.deepEqual(await readProvisional(store), {});
  assert.equal(asyncStore.__store.size, 0);
});
