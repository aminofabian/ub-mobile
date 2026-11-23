import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshPhone, installFetch, offlineNetwork } from './support/world.mjs';
import * as ConstantsFake from './support/fakes/expo-constants.mjs';
import { configureStorage } from '../src/storage';
import {
  DEFAULT_PLATFORM_CONFIG,
  compareVersions,
  fetchPlatformConfig,
  getAppVersion,
  parsePlatformConfig,
  parseVersion,
  updateStateFor,
} from '../src/platform-config';
import { API, PLATFORM_TODAY, PLATFORM_URL } from './fixtures';

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

test('a version is its numbers; a suffix is ignored and a non-number is not a version', () => {
  assert.deepEqual(parseVersion('1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion(' 1.2 '), [1, 2]);
  assert.deepEqual(parseVersion('2.0.0-beta.1'), [2, 0, 0]);
  assert.deepEqual(parseVersion('3.1.4+build.9'), [3, 1, 4]);
  for (const junk of ['', 'v1.2', 'abc', '1..2', '1.x', '-1']) {
    assert.equal(parseVersion(junk), null, JSON.stringify(junk));
  }
});

test('versions compare by number, not as text, and a missing part is zero', () => {
  assert.ok(compareVersions([1, 10, 0], [1, 9, 9]) > 0);
  assert.ok(compareVersions([1, 2], [1, 10]) < 0);
  assert.equal(compareVersions([1, 2], [1, 2, 0]), 0);
  assert.equal(compareVersions([0, 0, 1], [0, 0, 1]), 0);
  assert.ok(compareVersions([2], [1, 99, 99]) > 0);
});

test('what the server sends today leaves every default alone', () => {
  const config = parsePlatformConfig(PLATFORM_TODAY);
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.minAppVersion, '0.0.1');
  assert.deepEqual(config.blockedVersions, []);
  assert.equal(config.directoryEnabled, true);
  assert.equal(config.shopCodesEnabled, false);
  assert.equal(config.support, undefined);
  assert.equal(config.demoShop, undefined);
  assert.equal(config.storeLinks, undefined);
});

test('an answer that is not an object is the defaults, and the defaults are never shared', () => {
  for (const junk of [null, undefined, 'text', 42, [], true]) {
    assert.deepEqual(parsePlatformConfig(junk), DEFAULT_PLATFORM_CONFIG);
  }
  const first = parsePlatformConfig(null);
  first.blockedVersions.push('9.9.9');
  assert.deepEqual(parsePlatformConfig(null).blockedVersions, []);
  assert.deepEqual(DEFAULT_PLATFORM_CONFIG.blockedVersions, []);
});

test('every new field is read when it is right and dropped when it is not', () => {
  const config = parsePlatformConfig({
    schemaVersion: 2,
    minAppVersion: '1.4.0',
    blockedVersions: ['1.3.2', 'banana', 7, null, '1.3.3-rc.1'],
    support: { phone: '+254 700 000 000', email: 'help@kiosk.ke', whatsapp: 'nope', url: 'javascript:alert(1)' },
    directoryEnabled: false,
    shopCodesEnabled: true,
    demoShop: 'Demo-Shop',
    storeLinks: { ios: 'https://apps.apple.com/app/id1', android: 'ftp://play.example/app' },
  });
  assert.equal(config.schemaVersion, 2);
  assert.equal(config.minAppVersion, '1.4.0');
  assert.deepEqual(config.blockedVersions, ['1.3.2', '1.3.3-rc.1']);
  assert.deepEqual(config.support, { phone: '+254 700 000 000', email: 'help@kiosk.ke' });
  assert.equal(config.directoryEnabled, false);
  assert.equal(config.shopCodesEnabled, true);
  assert.equal(config.demoShop, 'demo-shop');
  assert.deepEqual(config.storeLinks, { ios: 'https://apps.apple.com/app/id1' });
});

test('a switch is on only when the server says exactly so', () => {
  assert.equal(parsePlatformConfig({ shopCodesEnabled: 'true' }).shopCodesEnabled, false);
  assert.equal(parsePlatformConfig({ shopCodesEnabled: 1 }).shopCodesEnabled, false);
  assert.equal(parsePlatformConfig({ directoryEnabled: 'false' }).directoryEnabled, true);
  assert.equal(parsePlatformConfig({ directoryEnabled: 0 }).directoryEnabled, true);
  assert.equal(parsePlatformConfig({ minAppVersion: 'soon' }).minAppVersion, undefined);
  assert.equal(parsePlatformConfig({ demoShop: 'two words' }).demoShop, undefined);
  assert.equal(parsePlatformConfig({ support: { email: 'not-an-email' } }).support, undefined);
});

test('the server today never asks anyone to update', () => {
  const today = parsePlatformConfig(PLATFORM_TODAY);
  assert.deepEqual(updateStateFor('0.0.1', today, 'android'), { required: false });
  assert.deepEqual(updateStateFor('0.0.1', today, 'ios'), { required: false });
  assert.deepEqual(updateStateFor('3.2.0', today, 'android'), { required: false });
});

test('a build below the minimum is asked to update, and sent to its own store', () => {
  const config = parsePlatformConfig({
    minAppVersion: '1.4.0',
    storeLinks: { ios: 'https://apps.apple.com/app/id1', android: 'https://play.google.com/store/apps/details?id=ke.kiosk' },
  });
  assert.deepEqual(updateStateFor('1.3.9', config, 'android'), {
    required: true,
    reason: 'below_minimum',
    minAppVersion: '1.4.0',
    storeUrl: 'https://play.google.com/store/apps/details?id=ke.kiosk',
  });
  assert.equal(updateStateFor('1.3.9', config, 'ios').required && (updateStateFor('1.3.9', config, 'ios') as { storeUrl?: string }).storeUrl, 'https://apps.apple.com/app/id1');
  assert.deepEqual(updateStateFor('1.4.0', config, 'android'), { required: false });
  assert.deepEqual(updateStateFor('1.10.0', config, 'android'), { required: false });
  assert.deepEqual(updateStateFor('0.9', config, 'android').required, true);
});

test('a version on the blocked list is refused, and its neighbours are not', () => {
  const config = parsePlatformConfig({ minAppVersion: '1.0.0', blockedVersions: ['1.2.0'] });
  assert.deepEqual(updateStateFor('1.2.0', config, 'android'), { required: true, reason: 'blocked', minAppVersion: '1.0.0' });
  assert.deepEqual(updateStateFor('1.2', config, 'android').required, true, '1.2 is 1.2.0');
  assert.deepEqual(updateStateFor('1.2.1', config, 'android'), { required: false });
  assert.deepEqual(updateStateFor('1.1.9', config, 'android'), { required: false });
});

test('when either side is unknown nobody is locked out', () => {
  const strict = parsePlatformConfig({ minAppVersion: '99.0.0', blockedVersions: ['1.0.0'] });
  assert.deepEqual(updateStateFor(undefined, strict, 'android'), { required: false });
  assert.deepEqual(updateStateFor('not a version', strict, 'android'), { required: false });
  assert.deepEqual(updateStateFor('1.0.0', null, 'android'), { required: false });
});

test('the platform answer is fetched from its route, and anything that is not an answer is null', async () => {
  const handle = serve([[PLATFORM_URL, { status: 200, body: { ...PLATFORM_TODAY, support: { email: 'help@kiosk.ke' } } }]]);
  const config = await fetchPlatformConfig(API);
  assert.equal(config?.support?.email, 'help@kiosk.ke');
  assert.equal(handle.calls[0]?.url, PLATFORM_URL);

  serve([[PLATFORM_URL, { status: 404, body: {} }]]);
  assert.equal(await fetchPlatformConfig(API), null);
  serve([[PLATFORM_URL, { status: 500, body: {} }]]);
  assert.equal(await fetchPlatformConfig(API), null);
  serve([[PLATFORM_URL, { status: 200, body: {}, invalidJson: true }]]);
  assert.equal(await fetchPlatformConfig(API), null);
  net?.restore();
  net = offlineNetwork();
  assert.equal(await fetchPlatformConfig(API), null);
});

test('the build knows its own version from its manifest, or says nothing', () => {
  assert.equal(getAppVersion(), undefined);
  ConstantsFake.__setVersion('2.5.1');
  assert.equal(getAppVersion(), '2.5.1');
  ConstantsFake.__setVersion('  ');
  assert.equal(getAppVersion(), undefined);
});

test('an address is followed only when it is secure, plain, and plainly about its own host', () => {
  const refused = [
    'http://help.kiosk.ke',
    'ftp://help.kiosk.ke',
    'https://help.kiosk.ke@evil.example',
    'https://user:pass@help.kiosk.ke',
    'https://h\u0435lp.kiosk.ke', // a Cyrillic letter that looks like a Latin one
    'https://münchen.example',
    'https://',
    'https:///path',
    'https://exa mple.com',
  ];
  for (const url of refused) {
    assert.equal(parsePlatformConfig({ support: { url } }).support, undefined, url);
  }
  const fine = 'https://help.kiosk.ke/contact?topic=app#top';
  assert.deepEqual(parsePlatformConfig({ support: { url: fine } }).support, { url: fine });
  assert.deepEqual(parsePlatformConfig({ support: { url: 'https://localhost:8080' } }).support, { url: 'https://localhost:8080' });
});

test("the update screen links to the platform's app in a store, and to nothing else", () => {
  const links = (ios: string, android: string) => parsePlatformConfig({ storeLinks: { ios, android } }).storeLinks;
  const apple = 'https://apps.apple.com/ke/app/kiosk/id1';
  const play = 'https://play.google.com/store/apps/details?id=ke.kiosk';
  assert.deepEqual(links(apple, play), { ios: apple, android: play });
  assert.deepEqual(links('https://itunes.apple.com/app/id1', 'http://play.google.com/store/apps/details?id=x'), {
    ios: 'https://itunes.apple.com/app/id1',
  });
  const lookalikes = [
    'https://apps.apple.com.evil.example/app/id1',
    'https://apps.apple.com@evil.example/',
    'https://evilapps.apple.com/',
    'https://play.google.com.evil.example/',
    'https://example.com/play.google.com',
    'https://help.kiosk.ke/update',
  ];
  for (const lookalike of lookalikes) {
    assert.equal(links(lookalike, lookalike), undefined, lookalike);
  }
});

test('an email can add nothing to the message it opens', () => {
  const refused = [
    'help@kiosk.ke?subject=hi',
    'help@kiosk.ke&cc=a@b.co',
    'help@kiosk.ke;bcc=x@y.zz',
    'a,b@kiosk.ke',
    'he lp@kiosk.ke',
    'help@kiosk',
    '@kiosk.ke',
    'help@.ke',
  ];
  for (const email of refused) {
    assert.equal(parsePlatformConfig({ support: { email } }).support, undefined, email);
  }
  const fine = 'first.last+app@mail.kiosk.co.ke';
  assert.deepEqual(parsePlatformConfig({ support: { email: fine } }).support, { email: fine });
});
