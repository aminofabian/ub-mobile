// node --test scripts/white-label-config.test.js
//
// What expo-white-label.js promises: the generic build is branded by tenants/_shared and embeds no shop,
// and a shop's build (Palmart, the reference one) stays that shop's, whatever the generic build does.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const applyWhiteLabel = require('../expo-white-label');
const { applyMarketplace, brandPlugins } = applyWhiteLabel;

const mobileRoot = path.join(__dirname, '..');
const APPS = ['shopper', 'cashier', 'grocery', 'admin', 'stock'];
const PROJECT = '11111111-2222-3333-4444-555555555555';

const profile = (overrides = {}) => ({
  id: '_shared',
  marketplace: true,
  displayName: 'Kiosk',
  apiBaseUrl: 'https://api.kiosk.ke',
  apps: {
    shopper: {
      name: 'Kiosk Ke Shopper',
      expoSlug: 'kiosk-shopper',
      iosBundleId: 'com.kioskke.shopper',
      androidPackage: 'com.kioskke.shopper',
      ...overrides,
    },
  },
});

const baseExpo = () => ({
  name: 'x',
  slug: 'x',
  version: '1.0.0',
  scheme: ['kioskshopper', 'kiosk'],
  ios: { supportsTablet: true, bundleIdentifier: 'old.ios' },
  android: { package: 'old.android', adaptiveIcon: { backgroundColor: '#28a745' } },
  extra: { apiBaseURL: 'https://api.kiosk.ke' },
});

// ── the shared (marketplace) profile ────────────────────────────────────────

test('marketplace: brands the listing and embeds no shop', () => {
  const out = applyMarketplace(baseExpo(), 'shopper', profile({ easProjectId: PROJECT }), '_shared');
  assert.equal(out.name, 'Kiosk Ke Shopper');
  assert.equal(out.slug, 'kiosk-shopper');
  assert.equal(out.ios.bundleIdentifier, 'com.kioskke.shopper');
  assert.equal(out.android.package, 'com.kioskke.shopper');
  assert.equal(out.ios.supportsTablet, true, 'other native settings are kept');
  assert.equal(out.android.adaptiveIcon.backgroundColor, '#28a745');
  assert.deepEqual(out.scheme, ['kioskshopper', 'kiosk'], 'schemes are not the profile\'s to set');
  for (const key of ['isWhiteLabel', 'embeddedTenantSlug', 'tenantId', 'tenantDisplayName', 'tenantHost', 'primaryColor', 'themeColors']) {
    assert.equal(key in out.extra, false, `extra.${key} must not be set`);
  }
  assert.equal(out.extra.apiBaseURL, 'https://api.kiosk.ke');
});

test('marketplace: its own Expo project gives it an OTA identity', () => {
  const out = applyMarketplace(baseExpo(), 'shopper', profile({ easProjectId: PROJECT }), '_shared');
  assert.deepEqual(out.runtimeVersion, { policy: 'appVersion' });
  assert.equal(out.updates.url, `https://u.expo.dev/${PROJECT}`);
  assert.equal(out.extra.eas.projectId, PROJECT);
});

test('marketplace: other update settings survive', () => {
  const expo = { ...baseExpo(), updates: { fallbackToCacheTimeout: 0 }, extra: { eas: { other: 1 } } };
  const out = applyMarketplace(expo, 'shopper', profile({ easProjectId: PROJECT }), '_shared');
  assert.equal(out.updates.fallbackToCacheTimeout, 0);
  assert.equal(out.extra.eas.other, 1);
});

test('marketplace: with no Expo project there is no updates.url and no project id', () => {
  const out = applyMarketplace(baseExpo(), 'shopper', profile(), '_shared');
  assert.equal(out.updates, undefined);
  assert.equal(out.extra.eas, undefined);
  assert.deepEqual(out.runtimeVersion, { policy: 'appVersion' });
});

test('marketplace: an app the profile does not list is an error, not a silent default', () => {
  assert.throws(() => applyMarketplace(baseExpo(), 'cashier', profile(), '_shared'), /no app profile for "cashier"/);
});

// ── permission prompts ──────────────────────────────────────────────────────

test('brandPlugins: a shop\'s build names the shop where the platform was named', () => {
  const plugins = ['expo-secure-store', ['expo-camera', { cameraPermission: 'Allow Kiosk to use your camera.' }]];
  const out = brandPlugins(plugins, 'Fresh Mart');
  assert.deepEqual(out, ['expo-secure-store', ['expo-camera', { cameraPermission: 'Allow Fresh Mart to use your camera.' }]]);
  assert.equal(plugins[1][1].cameraPermission, 'Allow Kiosk to use your camera.', 'input is not mutated');
});

test('brandPlugins: a name with replacement patterns in it is used literally', () => {
  const out = brandPlugins([['p', { text: 'Kiosk' }]], "Jo's $& Mart $1");
  assert.equal(out[0][1].text, "Jo's $& Mart $1");
});

test('brandPlugins: words that merely contain the name, and non-string options, are left alone', () => {
  const out = brandPlugins([['p', { a: 'Kiosks', b: 'MyKiosk', n: 3, flag: true }]], 'Fresh Mart');
  assert.deepEqual(out, [['p', { a: 'Kiosks', b: 'MyKiosk', n: 3, flag: true }]]);
  assert.equal(brandPlugins(undefined, 'x'), undefined);
});

// ── a shop's build, end to end ──────────────────────────────────────────────

function resolve(app, env) {
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !['TENANT_ID', 'KIOSK_TENANT', 'EAS_BUILD', 'NODE_ENV'].includes(key) && !key.startsWith('EXPO_PUBLIC_'),
    ),
  );
  const result = spawnSync(process.execPath, ['-e', "process.stdout.write(JSON.stringify(require('./app.config.js')))"], {
    cwd: path.join(mobileRoot, 'apps', app),
    env: { ...clean, EAS_BUILD: 'true', NODE_ENV: 'production', ...env },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).expo;
}

for (const app of APPS) {
  test(`a Palmart build of ${app} is still Palmart's`, () => {
    const expo = resolve(app, { TENANT_ID: 'palmart' });
    assert.equal(expo.extra.isWhiteLabel, true);
    assert.equal(expo.extra.embeddedTenantSlug, 'palmart');
    assert.equal(expo.extra.tenantDisplayName, 'Palmart');
    assert.deepEqual(expo.scheme, ['palmart', 'kiosk']);
    assert.equal(expo.slug, `palmart-${app}`);
    assert.equal(expo.ios.bundleIdentifier, `com.palmart.${app}`);
    assert.equal(expo.android.package, `com.palmart.${app}`);
    assert.match(expo.icon, /tenants\/palmart\/assets\/icon\.png$/);
    assert.deepEqual(expo.extra.themeColors.primary, '#164715');
    assert.doesNotMatch(JSON.stringify(expo), /Allow Kiosk/, 'no platform name in a shop\'s permission prompts');
  });
}

test('the Palmart Shopper still asks for the camera in Palmart\'s name', () => {
  const expo = resolve('shopper', { TENANT_ID: 'palmart' });
  const camera = expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-camera');
  assert.equal(camera[1].cameraPermission, 'Allow Palmart to use your camera to scan product barcodes.');
});

test('with no tenant at all, the shared profile brands each app and no shop is embedded', () => {
  for (const app of APPS) {
    const expo = resolve(app, {});
    assert.equal(expo.name, `Kiosk Ke ${app[0].toUpperCase()}${app.slice(1)}`);
    assert.equal(expo.ios.bundleIdentifier, `com.kioskke.${app}`);
    assert.equal(expo.extra?.isWhiteLabel, undefined, app);
    assert.equal(expo.extra?.embeddedTenantSlug, undefined, app);
    assert.doesNotMatch(JSON.stringify(expo), /palmart/i, `${app}: nothing of Palmart's in the generic config`);
  }
});
