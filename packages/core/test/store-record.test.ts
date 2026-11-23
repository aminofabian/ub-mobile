import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore, freshPhone, installFetch, offlineNetwork } from './support/world.mjs';
import { configureStorage, plain } from '../src/storage';
import * as K from '../src/storage-keys';
import {
  listRememberedStores,
  loadActiveStore,
  loadStoreById,
  openRememberedStore,
  openStore,
  registerUnsentProbe,
  revalidateActive,
  subscribeActiveStore,
  switchStore,
} from '../src/tenant';
import { previewStore } from '../src/tenant-resolve';
import { ACME, API, BOBS, hostBody, hostUrl, mobileBody, mobileUrl } from './fixtures';

type Handle = { calls: Array<{ url: string; method: string }>; restore(): void };
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

function serve(routes: unknown[]): Handle {
  net?.restore();
  net = installFetch(routes) as Handle;
  return net;
}

const shopper = { audience: 'shopper' as const };
const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

function bothShops(overrides: Record<string, unknown> = {}): unknown[] {
  return [
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME, overrides) }],
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
  ];
}

// ---------------------------------------------------------------------------------------------
// What the server says a shop can do
// ---------------------------------------------------------------------------------------------

test('a shop that says what it is and what it offers is saved with both', async () => {
  serve(bothShops({ storeTypes: ['Restaurant', 'lodging', 'lodging', 'bad name', 7], capabilities: { tableOrdering: true, powerTokens: false, bad: 'yes', 'bad name': true } }));
  const result = await previewStore('acme', API, shopper);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.deepEqual(result.store.storeTypes, ['restaurant', 'lodging']);
  assert.deepEqual(result.store.capabilities, { tableOrdering: true, powerTokens: false });
});

test('a server that says nothing about it leaves the saved shop exactly as it was', async () => {
  serve(bothShops());
  const result = await previewStore('acme', API, shopper);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.equal('storeTypes' in result.store, false);
  assert.equal('capabilities' in result.store, false);
});

test('anything that is not a list of names, or a map of true and false, says nothing', async () => {
  serve(bothShops({ storeTypes: 'restaurant', capabilities: ['powerTokens'] }));
  const result = await previewStore('acme', API, shopper);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.equal('storeTypes' in result.store, false);
  assert.equal('capabilities' in result.store, false);
});

test('the limits hold: twelve formats, forty capabilities', async () => {
  const types = Array.from({ length: 30 }, (_, index) => `format-${index}`);
  const capabilities = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`cap${index}`, index % 2 === 0]));
  serve(bothShops({ storeTypes: types, capabilities }));
  const result = await previewStore('acme', API, shopper);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.equal(result.store.storeTypes?.length, 12);
  assert.equal(Object.keys(result.store.capabilities ?? {}).length, 40);
});

test('a shop found by its address is saved with what it offers, when the answer says', async () => {
  serve([[hostUrl(ACME.host), { status: 200, body: hostBody(ACME, { storeTypes: ['restaurant'], capabilities: { tableOrdering: true, powerTokens: false, bad: 'no' } }) }]]);
  const result = await previewStore(ACME.host, API, shopper);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.deepEqual(result.store.storeTypes, ['restaurant']);
  assert.deepEqual(result.store.capabilities, { tableOrdering: true, powerTokens: false });
});

test('a shop found by its address, with nothing said about it, is saved exactly as before', async () => {
  serve([[hostUrl(ACME.host), { status: 200, body: hostBody(ACME) }]]);
  const result = await previewStore(ACME.host, API, shopper);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.equal('storeTypes' in result.store, false);
  assert.equal('capabilities' in result.store, false);
});

test('what a shop offers survives being closed and opened again from the phone', async () => {
  serve(bothShops({ capabilities: { powerTokens: false } }));
  const opened = await openStore('acme', API, { audience: 'shopper' });
  assert.equal(opened.kind, 'opened');
  configureStorage(null); // the app is closed; only what is on the phone is left
  const saved = await loadActiveStore();
  assert.deepEqual(saved?.capabilities, { powerTokens: false });
  assert.deepEqual((await loadStoreById(ACME.tenantId))?.capabilities, { powerTokens: false });
});

test('a shop opened by its address is completed by one more question to the server', async () => {
  // host/resolve does not carry what a shop offers; the mobile config does.
  serve([
    [hostUrl('acme.kiosk.ke'), { status: 200, body: hostBody(ACME) }],
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { capabilities: { powerTokens: false } }) }],
  ]);
  const opened = await openStore('acme.kiosk.ke', API, { audience: 'shopper' });
  assert.equal(opened.kind, 'opened');
  assert.equal((await loadActiveStore())?.capabilities, undefined);
  const result = await revalidateActive(API, shopper);
  assert.equal(result?.kind, 'found');
  assert.deepEqual((await loadActiveStore())?.capabilities, { powerTokens: false });
});

test('screens are told when what a shop offers changes, and not when it only comes back in another order', async () => {
  const handle = serve(bothShops({ capabilities: { powerTokens: true, airtime: true }, storeTypes: ['mini-mart'] }));
  await openStore('acme', API, { audience: 'shopper' });
  const heard: Array<Record<string, boolean> | undefined> = [];
  const stop = subscribeActiveStore((store) => heard.push(store?.capabilities));
  void handle;

  serve(bothShops({ capabilities: { airtime: true, powerTokens: true }, storeTypes: ['mini-mart'] }));
  await revalidateActive(API, shopper);
  assert.equal(heard.length, 0, 'the same capabilities in another order are not news');

  serve(bothShops({ capabilities: { airtime: true, powerTokens: false }, storeTypes: ['mini-mart'] }));
  await revalidateActive(API, shopper);
  assert.equal(heard.length, 1);
  assert.deepEqual(heard[0], { airtime: true, powerTokens: false });

  serve(bothShops({ capabilities: { airtime: true, powerTokens: false }, storeTypes: ['mini-mart', 'butchery'] }));
  await revalidateActive(API, shopper);
  assert.equal(heard.length, 2, 'a new format is news');
  stop();
});

// ---------------------------------------------------------------------------------------------
// Opening a shop the phone already knows
// ---------------------------------------------------------------------------------------------

async function rememberBoth() {
  serve(bothShops());
  assert.equal((await openStore('acme', API, shopper)).kind, 'opened');
  assert.equal((await openStore('bobs', API, shopper)).kind, 'opened');
}

test('a remembered shop opens with no connection at all', async () => {
  await rememberBoth();
  net?.restore();
  net = offlineNetwork() as Handle;
  const result = await openRememberedStore(ACME.tenantId, API, shopper);
  assert.equal(result.kind, 'opened');
  assert.equal((await loadActiveStore())?.slug, 'acme');
  await settle(); // the background question fails quietly
  assert.equal((await loadActiveStore())?.slug, 'acme');
});

test('the server is asked about the shop in the background, and what it says is kept', async () => {
  await rememberBoth();
  const handle = serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { displayName: 'Acme Mart (new look)', capabilities: { powerTokens: false } }) }]]);
  const result = await openRememberedStore(ACME.tenantId, API, shopper);
  assert.equal(result.kind, 'opened');
  assert.equal(result.kind === 'opened' ? result.store.displayName : '', ACME.name, 'it opens on what the phone knows, at once');
  await settle();
  assert.equal(handle.calls.filter((call) => call.url === mobileUrl('acme')).length, 1);
  assert.equal((await loadActiveStore())?.displayName, 'Acme Mart (new look)');
  assert.deepEqual((await loadActiveStore())?.capabilities, { powerTokens: false });
});

test('a shop this phone has no record of is not found, and nothing changes', async () => {
  await rememberBoth();
  const before = (await loadActiveStore())?.businessId;
  assert.deepEqual(await openRememberedStore('dddddddd-0000-4000-8000-000000000009', API, shopper), { kind: 'not_found' });
  assert.deepEqual(await openRememberedStore('not an id', API, shopper), { kind: 'not_found' });
  assert.equal((await loadActiveStore())?.businessId, before);
});

test('a shop that was suspended is asked about first: back, still suspended, or unknown', async () => {
  await rememberBoth(); // bobs is active; acme is remembered
  assert.equal((await listRememberedStores()).length, 2);

  // Acme was suspended when the phone last heard: its saved record says so.
  await switchStore({ ...(await loadStoreById(ACME.tenantId))!, status: 'SUSPENDED' });
  await switchStore((await loadStoreById(BOBS.tenantId))!);
  assert.equal((await loadStoreById(ACME.tenantId))?.status, 'SUSPENDED');

  // Offline: it stays closed, and Bob's stays open.
  net?.restore();
  net = offlineNetwork() as Handle;
  assert.deepEqual(await openRememberedStore(ACME.tenantId, API, shopper), { kind: 'offline' });
  assert.equal((await loadActiveStore())?.slug, 'bobs');

  // Online and still suspended: told so, and nothing opens.
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { tenantStatus: 'SUSPENDED' }) }]]);
  const still = await openRememberedStore(ACME.tenantId, API, shopper);
  assert.equal(still.kind, 'unavailable');
  assert.equal((await loadActiveStore())?.slug, 'bobs');

  // Back in business: it opens on the fresh record.
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }]]);
  const back = await openRememberedStore(ACME.tenantId, API, shopper);
  assert.equal(back.kind, 'opened');
  assert.equal((await loadActiveStore())?.slug, 'acme');
  assert.equal((await loadActiveStore())?.status, 'ACTIVE');
});

test('a shop with sales not sent is not left silently, and is left when the person says so', async () => {
  await rememberBoth(); // bobs is active
  registerUnsentProbe(async (tenantId) => {
    const raw = asyncStore.__store.get(K.outboxKey(tenantId));
    return { total: raw ? (JSON.parse(raw) as unknown[]).length : 0, needsAttention: 0 };
  });
  await (await plain()).set(K.outboxKey(BOBS.tenantId), JSON.stringify([{ id: 's1' }, { id: 's2' }]));

  const blocked = await openRememberedStore(ACME.tenantId, API, shopper);
  assert.equal(blocked.kind, 'blocked');
  assert.equal((await loadActiveStore())?.slug, 'bobs');

  const opened = await openRememberedStore(ACME.tenantId, API, { audience: 'shopper', keepUnsent: true });
  assert.equal(opened.kind, 'opened');
  assert.equal((await loadActiveStore())?.slug, 'acme');
  const kept = JSON.parse(asyncStore.__store.get(K.outboxKey(BOBS.tenantId)) ?? '[]') as unknown[];
  assert.equal(kept.length, 2, "Bob's unsent sales wait in Bob's own queue");
});

// ---------------------------------------------------------------------------------------------
// A shop is the business that was saved, not whoever holds its address now
// ---------------------------------------------------------------------------------------------

test('a remembered shop whose address now belongs to another business is not opened in its place', async () => {
  await rememberBoth(); // bobs is active; acme is remembered
  await switchStore({ ...(await loadStoreById(ACME.tenantId))!, status: 'SUSPENDED' });
  await switchStore((await loadStoreById(BOBS.tenantId))!);

  const newOwner = { ...ACME, tenantId: 'eeeeeeee-0000-4000-8000-0000000000e5', name: 'Another Business' };
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(newOwner) }]]);
  assert.deepEqual(await openRememberedStore(ACME.tenantId, API, shopper), { kind: 'not_found' });
  assert.equal((await loadActiveStore())?.slug, 'bobs', 'nothing opened');
  assert.ok(!(await loadStoreById(newOwner.tenantId)), 'the other business was not saved');

  // That the other business is suspended too is not news about this one, and is not said as if it were.
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(newOwner, { tenantStatus: 'SUSPENDED' }) }]]);
  assert.deepEqual(await openRememberedStore(ACME.tenantId, API, shopper), { kind: 'not_found' });
  assert.equal((await loadActiveStore())?.slug, 'bobs');
});

test('a shop name arrives without anything that hides or reorders text, however the shop was found', async () => {
  const custom = { ...ACME, host: 'shop.example.co.ke' };
  serve([
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { displayName: 'Ac\u200Bme \u202EMart\n' }) }],
    [hostUrl('shop.example.co.ke'), { status: 200, body: hostBody(custom, { tenantName: ' Acme \u202E Mart', branding: { displayName: '\u2066' } }) }],
  ]);
  const bySlug = await previewStore('acme', API, shopper);
  assert.equal(bySlug.kind === 'found' ? bySlug.store.displayName : null, 'Acme Mart');
  const byHost = await previewStore('shop.example.co.ke', API, shopper);
  assert.equal(byHost.kind === 'found' ? byHost.store.displayName : null, 'Acme Mart');
});

test('a shop carried over from the old layout, still under its provisional id, opens on what the server says it is', async () => {
  await rememberBoth(); // bobs is active; acme is remembered
  // The phone knows acme only under a provisional id, and as suspended, so the server is asked first.
  const provisional = { ...(await loadStoreById(ACME.tenantId))!, businessId: 'pending-acme', status: 'SUSPENDED' };
  await switchStore(provisional);
  await switchStore((await loadStoreById(BOBS.tenantId))!);

  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }]]);
  const result = await openRememberedStore('pending-acme', API, shopper);
  assert.equal(result.kind, 'opened');
  assert.equal((await loadActiveStore())?.businessId, ACME.tenantId, 'it opens under the id the server confirmed');
});
