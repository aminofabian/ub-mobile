import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshPhone, installFetch, offlineNetwork } from './support/world.mjs';
import { configureStorage } from '../src/storage';
import {
  SHOP_CODE_ALPHABET,
  describeShopCodeProblem,
  parseShopCode,
  parseShopCodeLink,
} from '../src/shop-code';
import { parseScan, previewDeepLink } from '../src/deep-link';
import { previewStoreByCode } from '../src/tenant-resolve';
import { ACME, API, UNMAPPED, codeUrl, hostBody, hostUrl, mobileBody, mobileUrl } from './fixtures';

let net: { calls: Array<{ url: string }>; restore(): void } | null = null;

beforeEach(() => {
  freshPhone({});
  configureStorage(null);
});

afterEach(() => {
  net?.restore();
  net = null;
});

function serve(routes: unknown[]) {
  net?.restore();
  net = installFetch(routes);
  return net;
}

const shopper = { audience: 'shopper' as const };
const staff = { audience: 'staff' as const };

test('the code alphabet has 31 characters and none that look like another', () => {
  assert.equal(SHOP_CODE_ALPHABET.length, 31);
  assert.equal(new Set(SHOP_CODE_ALPHABET).size, 31);
  for (const confusing of ['0', 'O', '1', 'I', 'L']) {
    assert.equal(SHOP_CODE_ALPHABET.includes(confusing), false, confusing);
  }
  for (const character of SHOP_CODE_ALPHABET) {
    assert.deepEqual(parseShopCode(character.repeat(5)), { kind: 'ok', code: character.repeat(5) }, character);
  }
});

test('a typed code is tidied: case, spaces, dots, dashes and underscores do not matter', () => {
  assert.deepEqual(parseShopCode('k7m4q'), { kind: 'ok', code: 'K7M4Q' });
  assert.deepEqual(parseShopCode('  k7m 4q '), { kind: 'ok', code: 'K7M4Q' });
  assert.deepEqual(parseShopCode('K7-M4Q'), { kind: 'ok', code: 'K7M4Q' });
  assert.deepEqual(parseShopCode('k7.m4_q'), { kind: 'ok', code: 'K7M4Q' });
  assert.deepEqual(parseShopCode('K7M4QZ'), { kind: 'ok', code: 'K7M4QZ' });
});

test('a code that is still being typed, or that is too long, is not sent', () => {
  assert.deepEqual(parseShopCode(''), { kind: 'incomplete' });
  assert.deepEqual(parseShopCode('   '), { kind: 'incomplete' });
  assert.deepEqual(parseShopCode('K7M4'), { kind: 'incomplete' });
  assert.deepEqual(parseShopCode('K7M4QZ9'), { kind: 'too_long' });
});

test('the characters that are never in a code are named as soon as they are typed', () => {
  assert.deepEqual(parseShopCode('K0M4Q'), { kind: 'invalid_characters', characters: ['0'] });
  assert.deepEqual(parseShopCode('kom1'), { kind: 'invalid_characters', characters: ['O', '1'] });
  assert.deepEqual(parseShopCode('L'), { kind: 'invalid_characters', characters: ['L'] });
  assert.deepEqual(parseShopCode('K7M4Q!'), { kind: 'invalid_characters', characters: ['!'] });
  // Characters are checked before length, so a short code with a bad letter is already wrong.
  assert.equal(parseShopCode('O').kind, 'invalid_characters');
});

test('the problem sentence matches the problem, and says nothing while the person is typing', () => {
  assert.equal(describeShopCodeProblem(parseShopCode('')), null);
  assert.equal(describeShopCodeProblem(parseShopCode('K7M4')), null);
  assert.equal(describeShopCodeProblem(parseShopCode('K7M4Q')), null);
  assert.match(describeShopCodeProblem(parseShopCode('K0M4Q')) ?? '', /never use the letters I, L or O, or the digits 0 and 1/);
  assert.match(describeShopCodeProblem(parseShopCode('K7M4Q#')) ?? '', /letters and numbers only/);
  assert.match(describeShopCodeProblem(parseShopCode('K7M4QZ9')) ?? '', /at most 6/);
});

test('only a link on the platform\'s own address carries a code', () => {
  assert.equal(parseShopCodeLink('https://kiosk.ke/c/K7M4Q'), 'K7M4Q');
  assert.equal(parseShopCodeLink('https://www.kiosk.ke/c/k7m4q/'), 'K7M4Q');
  assert.equal(parseShopCodeLink('https://kiosk.ke/c/K7M4Q?utm_source=poster#top'), 'K7M4Q');
  assert.equal(parseShopCodeLink('https://kiosk.ke:443/c/K7M4Q'), 'K7M4Q');
  assert.equal(parseShopCodeLink('kiosk://c/K7M4Q'), 'K7M4Q');
  assert.equal(parseShopCodeLink('  https://KIOSK.KE/c/%4B7M4Q  '), 'K7M4Q');
  for (const other of [
    'https://evil.example/c/K7M4Q',
    'https://kiosk.ke.evil.example/c/K7M4Q',
    'https://acme.kiosk.ke/c/K7M4Q',
    'https://kiosk.ke/c/K0M4Q',
    'https://kiosk.ke/c/K7M4',
    'https://kiosk.ke/c/',
    'https://kiosk.ke/c',
    'https://kiosk.ke/c/K7M4Q/extra',
    'https://kiosk.ke/s/john',
    'https://kiosk.ke/c/%E0%A4%A',
    'kiosk://shop/acme',
    'K7M4Q',
    '',
  ]) {
    assert.equal(parseShopCodeLink(other), null, other);
  }
});

test('a scan is a code, a shop or nothing, and a bare word is never taken for a code', () => {
  assert.deepEqual(parseScan('https://kiosk.ke/c/K7M4Q'), { kind: 'code', code: 'K7M4Q' });
  assert.deepEqual(parseScan('kiosk://c/k7m4q'), { kind: 'code', code: 'K7M4Q' });
  assert.deepEqual(parseScan('kiosk://shop/acme'), { kind: 'store', input: 'acme' });
  assert.deepEqual(parseScan('https://acme.kiosk.ke/shop'), { kind: 'store', input: 'acme.kiosk.ke' });
  assert.deepEqual(parseScan('https://shop.example.co.ke/shop'), { kind: 'store', input: 'shop.example.co.ke' });
  assert.deepEqual(parseScan('acme.kiosk.ke'), { kind: 'store', input: 'acme.kiosk.ke' });
  assert.deepEqual(parseScan('  https://acme.kiosk.ke  '), { kind: 'store', input: 'https://acme.kiosk.ke' });
  assert.deepEqual(parseScan('K7M4Q'), { kind: 'store', input: 'K7M4Q' });
  for (const nothing of ['', '   ', 'two words', 'a@b.com', 'kiosk://unknown/acme']) {
    assert.deepEqual(parseScan(nothing), { kind: 'unknown' }, nothing);
  }
});

test('a code opens the shop the server names, the same way a name does', async () => {
  const handle = serve([[codeUrl('K7M4Q'), { status: 200, body: mobileBody(ACME, { capabilities: { powerTokens: false } }) }]]);
  const result = await previewStoreByCode('K7M4Q', API, shopper);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.equal(result.store.businessId, ACME.tenantId);
  assert.equal(result.store.slug, 'acme');
  assert.deepEqual(result.store.capabilities, { powerTokens: false });
  assert.equal(handle.calls.length, 1);
});

test('an unknown code is not found, and the other failures are not mistaken for it', async () => {
  serve([[codeUrl('K7M4Q'), { status: 404, body: {} }]]);
  assert.deepEqual(await previewStoreByCode('K7M4Q', API, shopper), { kind: 'not_found' });

  serve([[codeUrl('K7M4Q'), { status: 429, body: {}, headers: { 'Retry-After': '12' } }]]);
  assert.deepEqual(await previewStoreByCode('K7M4Q', API, shopper), { kind: 'rate_limited', retryAfterSec: 12 });

  serve([[codeUrl('K7M4Q'), { status: 502, body: {} }]]);
  assert.deepEqual(await previewStoreByCode('K7M4Q', API, shopper), { kind: 'offline' });

  net?.restore();
  net = offlineNetwork();
  assert.deepEqual(await previewStoreByCode('K7M4Q', API, shopper), { kind: 'offline' });
});

test('a shop found by code is held to the same rules as any other: suspended, and storefront off for shoppers only', async () => {
  serve([[codeUrl('K7M4Q'), { status: 200, body: mobileBody(ACME, { tenantStatus: 'SUSPENDED' }) }]]);
  const suspended = await previewStoreByCode('K7M4Q', API, shopper);
  assert.equal(suspended.kind, 'unavailable');
  assert.equal(suspended.kind === 'unavailable' ? suspended.reason : '', 'suspended');

  serve([[codeUrl('K7M4Q'), { status: 200, body: mobileBody(ACME, { storefrontEnabled: false }) }]]);
  const forShopper = await previewStoreByCode('K7M4Q', API, shopper);
  assert.equal(forShopper.kind === 'unavailable' ? forShopper.reason : '', 'storefront_disabled');
  assert.equal((await previewStoreByCode('K7M4Q', API, staff)).kind, 'found');
});

test('an answer that is not a shop is a fault in the server, not a missing code', async () => {
  serve([[codeUrl('K7M4Q'), { status: 200, body: { hello: 'world' } }]]);
  assert.deepEqual(await previewStoreByCode('K7M4Q', API, shopper), { kind: 'offline' });
  serve([[codeUrl('K7M4Q'), { status: 200, body: mobileBody(ACME, { tenantId: 'pending-acme' }) }]]);
  assert.deepEqual(await previewStoreByCode('K7M4Q', API, shopper), { kind: 'offline' });
});

test('looking up a code changes nothing on the phone', async () => {
  serve([[codeUrl('K7M4Q'), { status: 200, body: mobileBody(ACME) }]]);
  await previewStoreByCode('K7M4Q', API, shopper);
  const { loadActiveStore, listRememberedStores } = await import('../src/tenant');
  assert.equal(await loadActiveStore(), null);
  assert.deepEqual(await listRememberedStores(), []);
});

test('a link is looked up without being opened: a code, a shop address or a name', async () => {
  const handle = serve([
    [codeUrl('K7M4Q'), { status: 200, body: mobileBody(ACME) }],
    [hostUrl('acme.kiosk.ke'), { status: 200, body: hostBody(ACME) }],
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }],
  ]);

  const byCode = await previewDeepLink('https://kiosk.ke/c/K7M4Q', API, shopper);
  assert.equal(byCode?.intent, 'shop');
  assert.equal(byCode?.result.kind, 'found');

  const byHost = await previewDeepLink('https://acme.kiosk.ke/shop', API, shopper);
  assert.equal(byHost?.intent, 'shop');
  assert.equal(byHost?.result.kind, 'found');

  const byName = await previewDeepLink('kiosk://shop/acme', API, shopper);
  assert.equal(byName?.result.kind, 'found');

  const forStaff = await previewDeepLink('kiosk://login/acme', API, staff);
  assert.equal(forStaff?.intent, 'login');

  const { loadActiveStore } = await import('../src/tenant');
  assert.equal(await loadActiveStore(), null, 'a preview never opens the shop');
  assert.ok(handle.calls.length >= 4);
});

test('a link that is not about a shop is ignored, and an unknown code is a shop that was not found', async () => {
  serve([[codeUrl('ZZZZZ'), { status: 404, body: {} }]]);
  assert.equal(await previewDeepLink('https://example.com/article', API, shopper), null);
  assert.equal(await previewDeepLink('', API, shopper), null);
  assert.equal(await previewDeepLink('https://kiosk.ke/c/K0M4Q', API, shopper), null);
  assert.deepEqual((await previewDeepLink('https://kiosk.ke/c/ZZZZZ', API, shopper))?.result, { kind: 'not_found' });
  void UNMAPPED;
});

test('a code far longer than any shop link is not a shop link, and is never sent anywhere', () => {
  assert.deepEqual(parseScan('https://acme.kiosk.ke/shop?' + 'x'.repeat(400)), { kind: 'store', input: 'acme.kiosk.ke' });
  assert.deepEqual(parseScan('https://acme.kiosk.ke/shop?' + 'x'.repeat(600)), { kind: 'unknown' });
  assert.deepEqual(parseScan('acme'.repeat(200)), { kind: 'unknown' });
});
