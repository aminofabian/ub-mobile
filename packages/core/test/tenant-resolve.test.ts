import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshPhone, installFetch, offlineNetwork } from './support/world.mjs';
import { configureStorage } from '../src/storage';
import { classifyStore, describeStoreResult, parseStoreInput, platformSlugFromHost, previewStore } from '../src/tenant-resolve';
import { ACME, API, BOBS, UNMAPPED, hostBody, hostUrl, mobileBody, mobileUrl } from './fixtures';

let network: { calls: Array<{ url: string }>; restore(): void } | null = null;

beforeEach(() => {
  freshPhone({});
  configureStorage(null);
});

afterEach(() => {
  network?.restore();
  network = null;
});

function serve(routes: unknown[]) {
  network = installFetch(routes);
  return network;
}

const shopper = { audience: 'shopper' as const };
const staff = { audience: 'staff' as const };

test('what was typed becomes a slug or a host, or nothing', () => {
  assert.deepEqual(parseStoreInput('acme'), { kind: 'slug', slug: 'acme' });
  assert.deepEqual(parseStoreInput('  ACME  '), { kind: 'slug', slug: 'acme' });
  assert.deepEqual(parseStoreInput('green-grocers'), { kind: 'slug', slug: 'green-grocers' });
  assert.deepEqual(parseStoreInput('acme.kiosk.ke'), { kind: 'host', host: 'acme.kiosk.ke' });
  assert.deepEqual(parseStoreInput('https://Acme.Kiosk.ke/shop?x=1'), { kind: 'host', host: 'acme.kiosk.ke' });
  assert.deepEqual(parseStoreInput('shop.example.co.ke.'), { kind: 'host', host: 'shop.example.co.ke' });
  assert.deepEqual(parseStoreInput('acme.localhost:3000'), { kind: 'host', host: 'acme.localhost:3000' });
  for (const junk of ['', '   ', 'a@b.com', 'two words', '-acme', 'acme-', 'ac_me', 'https://', '.', 'a..b']) {
    assert.equal(parseStoreInput(junk), null, JSON.stringify(junk));
  }
});

test('only a host on the platform domain, with one ordinary label before it, names a shop', () => {
  assert.equal(platformSlugFromHost('acme.kiosk.ke'), 'acme');
  assert.equal(platformSlugFromHost('green-grocers.kiosk.ke'), 'green-grocers');
  assert.equal(platformSlugFromHost('acme.kiosk.ke:443'), 'acme');
  for (const host of ['kiosk.ke', 'a.b.kiosk.ke', 'www.kiosk.ke', 'api.kiosk.ke', 'shop.kiosk.ke', 'acme.example.com', 'acme.palmart.co.ke']) {
    assert.equal(platformSlugFromHost(host), null, host);
  }
});

test('a bare name goes to the mobile config and takes the host the server gives', async () => {
  const net = serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { tenantHost: 'shop.acme-mart.co.ke' }) }]]);
  const result = await previewStore('acme', API, shopper);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.equal(result.store.businessId, ACME.tenantId);
  assert.equal(result.store.host, 'shop.acme-mart.co.ke');
  assert.equal(result.store.displayName, ACME.name);
  assert.equal(result.store.status, 'ACTIVE');
  assert.deepEqual(result.store.branding, { displayName: ACME.name, primaryColor: '#123456' });
  assert.match(result.store.fetchedAt, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(net.calls.map((c) => c.url), [mobileUrl('acme')], 'one request, no host guessed');
});

test('a typed address goes to host resolve as typed, and that host is kept', async () => {
  const net = serve([[hostUrl('shop.example.co.ke'), { status: 200, body: hostBody(ACME) }]]);
  const result = await previewStore('https://Shop.Example.co.ke/shop', API, staff);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.equal(result.store.host, 'shop.example.co.ke');
  assert.equal(result.store.businessId, ACME.tenantId);
  assert.deepEqual(net.calls.map((c) => c.url), [hostUrl('shop.example.co.ke')]);
});

test('an unmapped address on the platform domain is still found by its first label', async () => {
  const net = serve([
    [hostUrl('acme.kiosk.ke'), { status: 200, body: UNMAPPED }],
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }],
  ]);
  const result = await previewStore('acme.kiosk.ke', API, shopper);
  assert.equal(result.kind, 'found');
  assert.deepEqual(net.calls.map((c) => c.url), [hostUrl('acme.kiosk.ke'), mobileUrl('acme')]);
});

test('an unmapped address that is not on the platform domain, or has a reserved label, is not a shop', async () => {
  const net = serve([[/host\/resolve/, { status: 200, body: UNMAPPED }]]);
  for (const input of ['shop.example.com', 'www.kiosk.ke', 'a.b.kiosk.ke']) {
    assert.deepEqual(await previewStore(input, API, shopper), { kind: 'not_found' }, input);
  }
  assert.equal(net.calls.some((c) => c.url.includes('/mobile')), false);
});

test('an older backend that answers an unknown host with 404 is treated as unmapped', async () => {
  serve([[hostUrl('acme.kiosk.ke'), { status: 404, body: {} }], [mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }]]);
  assert.equal((await previewStore('acme.kiosk.ke', API, shopper)).kind, 'found');
});

test('input that cannot be a shop never reaches the network', async () => {
  const net = serve([]);
  for (const junk of ['', 'a@b.com', 'two words']) {
    assert.deepEqual(await previewStore(junk, API, shopper), { kind: 'not_found' });
  }
  assert.equal(net.calls.length, 0);
});

test('an unknown shop is not_found', async () => {
  serve([[mobileUrl('nope'), { status: 404, body: { detail: 'Not found' } }]]);
  assert.deepEqual(await previewStore('nope', API, shopper), { kind: 'not_found' });
});

test('no connection, a server error, a slow server and a page that is not ours all read as offline', async () => {
  const realFetch = globalThis.fetch;
  try {
    const off = offlineNetwork();
    assert.deepEqual(await previewStore('acme', API, shopper), { kind: 'offline' });
    off.restore();

    for (const status of [500, 502, 503, 408]) {
      const server = installFetch([[/./, { status, body: {} }]]);
      assert.deepEqual(await previewStore('acme', API, shopper), { kind: 'offline' }, String(status));
      server.restore();
    }

    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    })) as unknown as typeof fetch;
    assert.deepEqual(await previewStore('acme', API, shopper), { kind: 'offline' });

    globalThis.fetch = ((_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    const started = Date.now();
    assert.deepEqual(await previewStore('acme', API, { ...shopper, timeoutMs: 30 }), { kind: 'offline' });
    assert.ok(Date.now() - started < 2000);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the rate limit says how long to wait', async () => {
  serve([[/./, { status: 429, body: {}, headers: { 'Retry-After': '42' } }]]);
  assert.deepEqual(await previewStore('acme', API, shopper), { kind: 'rate_limited', retryAfterSec: 42 });
  network?.restore();
  serve([[/./, { status: 429, body: {} }]]);
  assert.deepEqual(await previewStore('acme', API, shopper), { kind: 'rate_limited', retryAfterSec: undefined });
  network?.restore();
  serve([[/./, { status: 429, body: {}, headers: { 'Retry-After': '999999' } }]]);
  const capped = await previewStore('acme', API, shopper);
  assert.equal(capped.kind === 'rate_limited' && capped.retryAfterSec, 3600);
});

test('a suspended or inactive shop is unavailable to everyone, and says which', async () => {
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { tenantStatus: 'SUSPENDED' }) }]]);
  for (const audience of ['shopper', 'staff'] as const) {
    const result = await previewStore('acme', API, { audience });
    assert.equal(result.kind, 'unavailable', audience);
    if (result.kind === 'unavailable') {
      assert.equal(result.reason, 'suspended');
      assert.equal(result.store?.displayName, ACME.name);
    }
  }
  network?.restore();
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { tenantStatus: 'INACTIVE' }) }]]);
  const inactive = await previewStore('acme', API, staff);
  assert.equal(inactive.kind === 'unavailable' && inactive.reason, 'not_listed');
});

test('a shop with its storefront off is closed to shoppers and open to its own staff', async () => {
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME, { storefrontEnabled: false }) }]]);
  const forShopper = await previewStore('acme', API, shopper);
  assert.equal(forShopper.kind === 'unavailable' && forShopper.reason, 'storefront_disabled');
  const forStaff = await previewStore('acme', API, staff);
  assert.equal(forStaff.kind, 'found');
  if (forStaff.kind === 'found') assert.equal(forStaff.store.storefrontEnabled, false);
});

test('a host that resolves to a shop with its storefront off follows the same rule', async () => {
  serve([[hostUrl('acme.kiosk.ke'), { status: 200, body: hostBody(ACME, { storefrontEnabled: false }) }]]);
  assert.equal((await previewStore('acme.kiosk.ke', API, shopper)).kind, 'unavailable');
  assert.equal((await previewStore('acme.kiosk.ke', API, staff)).kind, 'found');
});

test('a missing status or flag reads as an ordinary open shop, so an older backend still works', async () => {
  const body = mobileBody(ACME);
  delete (body as Record<string, unknown>).tenantStatus;
  delete (body as Record<string, unknown>).storefrontEnabled;
  serve([[mobileUrl('acme'), { status: 200, body }]]);
  const result = await previewStore('acme', API, shopper);
  assert.equal(result.kind, 'found');
  if (result.kind === 'found') assert.equal(result.store.status, 'ACTIVE');
});

test('an answer without a usable tenant id is not a shop, and nothing is made up to fill the gap', async () => {
  for (const bad of [
    mobileBody(ACME, { tenantId: undefined }),
    mobileBody(ACME, { tenantId: '' }),
    mobileBody(ACME, { tenantId: 'has spaces' }),
    mobileBody(ACME, { tenantId: 'pending-acme' }),
    mobileBody(ACME, { tenantHost: '' }),
  ]) {
    network?.restore();
    serve([[mobileUrl('acme'), { status: 200, body: bad }]]);
    const result = await previewStore('acme', API, staff);
    assert.notEqual(result.kind, 'found', JSON.stringify(bad));
  }
});

test('preview changes nothing on the device', async () => {
  const { secureStore, asyncStore } = await import('./support/world.mjs');
  serve([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }]]);
  await previewStore('acme', API, shopper);
  assert.equal(secureStore.__store.size, 0);
  assert.equal(asyncStore.__store.size, 0);
});

test('classifyStore: the audience decides about the storefront, the status decides for both', () => {
  const store = { businessId: ACME.tenantId, slug: 'acme', host: ACME.host, displayName: 'Acme', branding: {}, fetchedAt: '2026-11-22T00:00:00.000Z' };
  assert.equal(classifyStore({ ...store, status: 'ACTIVE', storefrontEnabled: true }, 'shopper').kind, 'found');
  assert.equal(classifyStore({ ...store, status: 'ACTIVE', storefrontEnabled: false }, 'shopper').kind, 'unavailable');
  assert.equal(classifyStore({ ...store, status: 'ACTIVE', storefrontEnabled: false }, 'staff').kind, 'found');
  assert.equal(classifyStore({ ...store, status: 'SUSPENDED' }, 'staff').kind, 'unavailable');
  assert.equal(classifyStore({ ...store, status: 'ARCHIVED' }, 'staff').kind, 'unavailable');
  assert.equal(classifyStore(store, 'staff').kind, 'found');
});

test('every non-success result has a sentence for a screen that has no design for it', () => {
  assert.match(describeStoreResult({ kind: 'offline' }), /connection/);
  assert.match(describeStoreResult({ kind: 'rate_limited', retryAfterSec: 30 }), /30 seconds/);
  assert.match(describeStoreResult({ kind: 'rate_limited' }), /minute/);
  assert.match(describeStoreResult({ kind: 'not_found' }, 'zzz'), /"zzz"/);
  assert.match(describeStoreResult({ kind: 'not_found' }, ''), /Enter/);
  const store = { businessId: BOBS.tenantId, slug: 'bobs', host: BOBS.host, displayName: BOBS.name, branding: {}, fetchedAt: '2026-11-22T00:00:00.000Z' };
  assert.match(describeStoreResult({ kind: 'unavailable', reason: 'suspended', store }), /Bob's Pharmacy is currently suspended/);
  assert.match(describeStoreResult({ kind: 'unavailable', reason: 'storefront_disabled', store }), /online orders/);
  assert.match(describeStoreResult({ kind: 'unavailable', reason: 'not_listed' }), /This shop/);
});
