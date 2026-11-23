import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore, freshPhone, installFetch, offlineNetwork } from './support/world.mjs';
import { configureStorage } from '../src/storage';
import {
  PAIRING_CODE_MAX_LENGTH,
  PAIRING_CODE_MIN_LENGTH,
  parsePairingCode,
  parsePairingPreview,
  parsePairingScan,
  previewPairing,
  redeemPairing,
} from '../src/pairing';
import { DEFAULT_PLATFORM_CONFIG, parsePlatformConfig } from '../src/platform-config';
import { API } from './fixtures';

type Handle = {
  calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: unknown }>;
  restore(): void;
};
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

test('a typed pairing code is tidied and checked before anything is sent', () => {
  assert.deepEqual(parsePairingCode('k7m4q9xd'), { kind: 'ok', code: 'K7M4Q9XD' });
  assert.deepEqual(parsePairingCode(' k7m4 q9xd '), { kind: 'ok', code: 'K7M4Q9XD' });
  assert.deepEqual(parsePairingCode('K7M4-Q9XD'), { kind: 'ok', code: 'K7M4Q9XD' });
  assert.deepEqual(parsePairingCode('k7.m4_q9xd'), { kind: 'ok', code: 'K7M4Q9XD' });
  assert.deepEqual(parsePairingCode(''), { kind: 'incomplete' });
  assert.deepEqual(parsePairingCode('K7M4Q'), { kind: 'incomplete' });
  assert.equal(PAIRING_CODE_MIN_LENGTH, 6);
  assert.equal(PAIRING_CODE_MAX_LENGTH, 12);
  assert.deepEqual(parsePairingCode('K'.repeat(PAIRING_CODE_MAX_LENGTH + 1)), { kind: 'too_long' });
  assert.deepEqual(parsePairingCode('K'.repeat(PAIRING_CODE_MAX_LENGTH)), { kind: 'ok', code: 'K'.repeat(PAIRING_CODE_MAX_LENGTH) });
  for (const bad of ['K7M4Q90D', 'K7M4QIID', 'K7M4QLLD', 'K7M4Q!XD', 'K7M4Q/XD', 'K7M4QéXD']) {
    assert.deepEqual(parsePairingCode(bad), { kind: 'invalid_characters' }, bad);
  }
});

test("a scanned pairing QR is accepted only in the platform's own two forms", () => {
  assert.equal(parsePairingScan('kiosk://pair/K7M4Q9XD'), 'K7M4Q9XD');
  assert.equal(parsePairingScan('  kiosk://pair/k7m4q9xd  '), 'K7M4Q9XD');
  assert.equal(parsePairingScan('KIOSK://PAIR/K7M4Q9XD'), 'K7M4Q9XD');
  assert.equal(parsePairingScan('kiosk://pair/K7M4Q9XD/'), 'K7M4Q9XD');
  assert.equal(parsePairingScan('kiosk://pair/K7M4Q9XD?from=poster'), 'K7M4Q9XD');
  assert.equal(parsePairingScan('kiosk://pair/%4B7M4Q9XD'), 'K7M4Q9XD');
  assert.equal(parsePairingScan('https://kiosk.ke/pair/K7M4Q9XD'), 'K7M4Q9XD');
  assert.equal(parsePairingScan('https://www.kiosk.ke/pair/K7M4Q9XD'), 'K7M4Q9XD');
  assert.equal(parsePairingScan('https://kiosk.ke:443/pair/K7M4Q9XD'), 'K7M4Q9XD');
});

test('a scanned pairing QR from anywhere else, or in any other shape, is ignored', () => {
  for (const bad of [
    'K7M4Q9XD',
    'pair K7M4Q9XD',
    'http://kiosk.ke/pair/K7M4Q9XD',
    'https://evil.example/pair/K7M4Q9XD',
    'https://kiosk.ke.evil.example/pair/K7M4Q9XD',
    'https://evilkiosk.ke/pair/K7M4Q9XD',
    'https://kiosk.ke@evil.example/pair/K7M4Q9XD',
    'https://evil.example/?next=https://kiosk.ke/pair/K7M4Q9XD',
    'https://acme.kiosk.ke/pair/K7M4Q9XD',
    'kiosk://pair/K7M4Q9XD/extra',
    'kiosk://pair/',
    'kiosk://pair/K7M4',
    'kiosk://pair/K7M4Q90D',
    'kiosk://pair/%E0%A4%A',
    'kiosk://shop/acme',
    'javascript:alert(1)',
    '',
    'kiosk://pair/' + 'K'.repeat(600),
    'kiosk://pair/K7M4Q9XD?' + 'x'.repeat(600),
  ]) {
    assert.equal(parsePairingScan(bad), null, bad.slice(0, 60));
  }
});

const PREVIEW = {
  shop: { host: 'acme.kiosk.ke', slug: 'acme', displayName: 'Acme Mart' },
  branch: { id: 'b-1', name: 'Westlands' },
  role: { key: 'cashier', name: 'Cashier' },
  tillName: 'Till 2',
};

test("the confirm card is built from the server's preview, cleaned, and refused when it cannot name a shop and a branch", () => {
  assert.deepEqual(parsePairingPreview(PREVIEW), {
    shop: 'acme.kiosk.ke',
    shopName: 'Acme Mart',
    branchId: 'b-1',
    branchName: 'Westlands',
    roleName: 'Cashier',
    tillName: 'Till 2',
  });
  assert.equal(parsePairingPreview({ ...PREVIEW, tillName: undefined })?.tillName, undefined);
  assert.equal(parsePairingPreview(PREVIEW)?.shopId, undefined, 'no id from the server, none invented');
  assert.equal(parsePairingPreview({ ...PREVIEW, shop: { ...PREVIEW.shop, id: 'biz-7' } })?.shopId, 'biz-7');
  assert.equal(parsePairingPreview({ ...PREVIEW, shop: { ...PREVIEW.shop, businessId: 'biz-8' } })?.shopId, 'biz-8');
  assert.equal(parsePairingPreview({ ...PREVIEW, shop: { ...PREVIEW.shop, id: 7 } })?.shopId, undefined, 'a number is not an id');
  assert.equal(parsePairingPreview({ ...PREVIEW, shop: { ...PREVIEW.shop, id: 'x'.repeat(65) } })?.shopId, undefined);
  assert.equal(parsePairingPreview({ ...PREVIEW, shop: { slug: 'acme' } })?.shop, 'acme');
  assert.equal(parsePairingPreview({ ...PREVIEW, shop: { slug: 'acme' } })?.shopName, 'acme');
  assert.equal(parsePairingPreview({ ...PREVIEW, branch: { id: 'b-1' } })?.branchName, 'this branch');
  assert.equal(parsePairingPreview({ ...PREVIEW, role: undefined })?.roleName, 'staff');
  assert.equal(parsePairingPreview({ ...PREVIEW, shop: { displayName: 'No address' } }), null);
  assert.equal(parsePairingPreview({ ...PREVIEW, branch: { name: 'No id' } }), null);
  assert.equal(parsePairingPreview(null), null);
  assert.equal(parsePairingPreview('x'), null);
  assert.equal(parsePairingPreview({ ...PREVIEW, branch: { id: 'x'.repeat(65), name: 'Too long id' } }), null);
  assert.equal(parsePairingPreview({ ...PREVIEW, shop: { host: 'acme.kiosk.ke', displayName: 'Acme‮ Mart' } })?.shopName, 'Acme Mart');
});

test('looking a code up has one outcome for each thing that can happen, and never throws', async () => {
  const lookup = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => {
    serve([['/api/v1/public/till-pairing/', { status, body, headers }]]);
    return previewPairing('K7M4Q9XD', API);
  };
  assert.deepEqual(await lookup(200, PREVIEW), {
    kind: 'found',
    preview: { shop: 'acme.kiosk.ke', shopName: 'Acme Mart', branchId: 'b-1', branchName: 'Westlands', roleName: 'Cashier', tillName: 'Till 2' },
  });
  assert.deepEqual(await lookup(404), { kind: 'not_found' });
  assert.deepEqual(await lookup(410), { kind: 'expired' }, 'past its time');
  assert.deepEqual(await lookup(409), { kind: 'used' }, 'a phone already has it');
  for (const status of [400, 401, 403, 422]) {
    assert.deepEqual(await lookup(status), { kind: 'refused' }, `${status}: the server would not take it`);
  }
  assert.deepEqual(await lookup(429, {}, { 'Retry-After': '30' }), { kind: 'rate_limited', retryAfterSec: 30 });
  assert.deepEqual(await lookup(429), { kind: 'rate_limited', retryAfterSec: undefined });
  for (const status of [500, 502, 503, 408, 302]) {
    assert.deepEqual(await lookup(status), { kind: 'offline' }, `${status}: no answer to the question`);
  }
  assert.deepEqual(await lookup(204), { kind: 'offline' }, 'a success with nothing to show is not a preview');
  assert.deepEqual(await lookup(201, PREVIEW), { kind: 'offline' }, 'only a 200 answers the question, whatever else is in the body');
  assert.deepEqual(await lookup(200, { shop: 'nonsense' }), { kind: 'offline' }, 'a 200 that is not a preview is the server misbehaving');
  net?.restore();
  net = offlineNetwork() as Handle;
  assert.deepEqual(await previewPairing('K7M4Q9XD', API), { kind: 'offline' });
});

test('looking a code up changes nothing on the phone, sends no credentials, and keeps the code out of the address', async () => {
  const handle = serve([['/api/v1/public/till-pairing/', { status: 200, body: PREVIEW }]]);
  await previewPairing('K7M4Q9XD', `${API}/`);
  assert.equal(handle.calls.length, 1);
  assert.equal(handle.calls[0]?.url, `${API}/api/v1/public/till-pairing/preview`);
  assert.equal(handle.calls[0]?.method, 'POST');
  assert.deepEqual(handle.calls[0]?.headers, { 'Content-Type': 'application/json' }, 'no token, tenant or cookie header');
  assert.deepEqual(JSON.parse(String(handle.calls[0]?.body)), { code: 'K7M4Q9XD' });
  assert.doesNotMatch(String(handle.calls[0]?.url), /K7M4Q9XD/);
  assert.equal(asyncStore.__store.size, 0);
});

test("pairing sends the code and the phone's own key in the body, and says what happened", async () => {
  const redeem = (status: number, headers: Record<string, string> = {}) => {
    const handle = serve([['/pair', { status, body: {}, headers }]]);
    return { handle, result: redeemPairing('K7M4Q9XD', 'till-key-1', API) };
  };
  const first = redeem(200);
  assert.deepEqual(await first.result, { kind: 'paired' });
  const call = first.handle.calls[0];
  assert.equal(call?.url, `${API}/api/v1/public/till-pairing/pair`);
  assert.equal(call?.method, 'POST');
  assert.deepEqual(JSON.parse(String(call?.body)), { code: 'K7M4Q9XD', deviceKey: 'till-key-1' });
  assert.deepEqual(call?.headers, { 'Content-Type': 'application/json' });

  for (const status of [200, 201, 204]) {
    assert.deepEqual(await redeem(status).result, { kind: 'paired' }, `${status} is a pairing, with or without a body`);
  }
  assert.deepEqual(await redeem(404).result, { kind: 'not_found' });
  assert.deepEqual(await redeem(409).result, { kind: 'used' }, 'a phone already has this code');
  assert.deepEqual(await redeem(410).result, { kind: 'expired' }, 'past its time');
  for (const status of [400, 401, 403, 422]) {
    assert.deepEqual(await redeem(status).result, { kind: 'refused' }, `${status}: the server would not take it`);
  }
  assert.deepEqual(await redeem(429, { 'Retry-After': '45' }).result, { kind: 'rate_limited', retryAfterSec: 45 });
  for (const status of [500, 503, 408, 302]) {
    assert.deepEqual(await redeem(status).result, { kind: 'offline' }, `${status}: no answer to the question`);
  }
  net?.restore();
  net = offlineNetwork() as Handle;
  assert.deepEqual(await redeemPairing('K7M4Q9XD', 'k', API), { kind: 'offline' });
});

test('a phone with no key of its own is never paired: nothing is sent', async () => {
  const handle = serve([['/pair', { status: 200, body: {} }]]);
  for (const blank of ['', ' ', '\n\t']) {
    assert.deepEqual(await redeemPairing('K7M4Q9XD', blank, API), { kind: 'refused' }, JSON.stringify(blank));
  }
  assert.equal(handle.calls.length, 0);
});

test('pairing is off unless the platform says true, and nothing else turns it on', () => {
  assert.equal(DEFAULT_PLATFORM_CONFIG.pairingEnabled, false);
  assert.equal(parsePlatformConfig(null).pairingEnabled, false);
  assert.equal(parsePlatformConfig({}).pairingEnabled, false);
  assert.equal(parsePlatformConfig({ pairingEnabled: true }).pairingEnabled, true);
  for (const value of [false, 'true', 1, 'yes', null, [], {}]) {
    assert.equal(parsePlatformConfig({ pairingEnabled: value }).pairingEnabled, false, JSON.stringify(value));
  }
});

test('whatever the code holds, it is data in the body and can never change the route', async () => {
  const odd = 'A/B?C#D"\\';
  const preview = serve([['/api/v1/public/till-pairing/', { status: 404, body: {} }]]);
  await previewPairing(odd, API);
  assert.equal(preview.calls[0]?.url, `${API}/api/v1/public/till-pairing/preview`);
  assert.deepEqual(JSON.parse(String(preview.calls[0]?.body)), { code: odd });
  const redeem = serve([['/api/v1/public/till-pairing/', { status: 404, body: {} }]]);
  await redeemPairing(odd, 'k', API);
  assert.equal(redeem.calls[0]?.url, `${API}/api/v1/public/till-pairing/pair`);
  assert.deepEqual(JSON.parse(String(redeem.calls[0]?.body)), { code: odd, deviceKey: 'k' });
});

test('how long to wait is capped, and nonsense waits are ignored', async () => {
  const wait = async (value: string) => {
    serve([['/api/v1/public/till-pairing/', { status: 429, body: {}, headers: { 'Retry-After': value } }]]);
    const lookedUp = await previewPairing('K7M4Q9XD', API);
    const redeemed = await redeemPairing('K7M4Q9XD', 'k', API);
    assert.deepEqual(lookedUp, redeemed, 'both calls read the wait the same way');
    return lookedUp.kind === 'rate_limited' ? lookedUp.retryAfterSec : 'not rate limited';
  };
  assert.equal(await wait('99999'), 3600);
  assert.equal(await wait('7.2'), 8);
  assert.equal(await wait('-5'), undefined);
  assert.equal(await wait('soon'), undefined);
});
