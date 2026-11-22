/**
 * Tests for the pure parts of the config guard and the channel guard.
 * Run from mobile/:  node --test scripts/*.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SHARED_TENANT_ID,
  checkChannel,
  checkProfile,
  defaultChannel,
  defaultProfile,
  renderEasConfig,
  resolveProfile,
} = require('./lib/channel-guard');
const {
  checkAssetCopies,
  checkEas,
  classify,
  checkResolvedConfig,
  checkSharedProfile,
  expectedSchemes,
  scanSource,
} = require('./lib/generic-guard');
const allowList = require('./lib/palmart-allow-list');

const PROJECT = '11111111-2222-3333-4444-555555555555';

// ── channel guard ───────────────────────────────────────────────────────────

const eas = {
  build: {
    base: {},
    production: { extends: 'base', channel: 'generic-{app}-production' },
    preview: { extends: 'base', channel: 'generic-{app}-preview' },
    palmart: { extends: 'production', channel: 'palmart-production', env: { TENANT_ID: 'palmart', KIOSK_TENANT: 'palmart' } },
    'palmart-preview': { extends: 'preview', channel: 'palmart-preview', env: { TENANT_ID: 'palmart', KIOSK_TENANT: 'palmart' } },
    'tenant-preview': { extends: 'preview', channel: 'tenant-preview' },
  },
};

test('resolveProfile follows extends and lets the child win', () => {
  const resolved = resolveProfile(eas, 'palmart-preview');
  assert.equal(resolved.channel, 'palmart-preview');
  assert.deepEqual(resolved.env, { TENANT_ID: 'palmart', KIOSK_TENANT: 'palmart' });
  assert.equal(resolveProfile(eas, 'tenant-preview').channel, 'tenant-preview');
});

test('resolveProfile refuses a cycle and a missing parent', () => {
  assert.throws(() => resolveProfile({ build: { a: { extends: 'b' }, b: { extends: 'a' } } }, 'a'), /extends itself/);
  assert.throws(() => resolveProfile({ build: { a: { extends: 'gone' } } }, 'a'), /no build profile "gone"/);
});

test('a shop may use its own channels and the tenant-neutral ones', () => {
  const tenants = ['palmart', 'acme'];
  for (const channel of ['acme', 'acme-preview', 'acme-production', 'tenant-production']) {
    assert.equal(checkChannel({ tenant: 'acme', app: 'cashier', channel, knownTenants: tenants }).ok, true, channel);
  }
});

test('a shop may not use another shop\'s channel, a generic one, or none', () => {
  const tenants = ['palmart', 'acme'];
  const other = checkChannel({ tenant: 'acme', app: 'cashier', channel: 'palmart-preview', knownTenants: tenants });
  assert.equal(other.ok, false);
  assert.match(other.reason, /belongs to palmart/);
  assert.equal(checkChannel({ tenant: 'acme', app: 'cashier', channel: 'generic-cashier-preview', knownTenants: tenants }).ok, false);
  assert.equal(checkChannel({ tenant: 'acme', app: 'cashier', channel: 'preview', knownTenants: tenants }).ok, false);
  assert.equal(checkChannel({ tenant: 'acme', app: 'cashier', channel: undefined, knownTenants: tenants }).ok, false);
  // a shop called "acmefoods" must not pass as "acme"
  assert.equal(checkChannel({ tenant: 'acme', app: 'cashier', channel: 'acmefoods-preview', knownTenants: tenants }).ok, false);
});

test('the generic build only gets its own app\'s generic channel', () => {
  assert.equal(checkChannel({ tenant: SHARED_TENANT_ID, app: 'cashier', channel: 'generic-cashier-preview' }).ok, true);
  assert.equal(checkChannel({ tenant: SHARED_TENANT_ID, app: 'cashier', channel: 'generic-shopper-preview' }).ok, false);
  assert.equal(checkChannel({ tenant: SHARED_TENANT_ID, app: 'cashier', channel: 'palmart-preview' }).ok, false);
});

test('reserved slugs cannot be shops', () => {
  assert.equal(checkChannel({ tenant: 'generic', app: 'cashier', channel: 'generic-cashier-preview' }).ok, false);
  assert.equal(checkChannel({ tenant: 'tenant', app: 'cashier', channel: 'tenant-preview' }).ok, false);
});

test('defaults never name Palmart for another shop', () => {
  assert.equal(defaultChannel({ tenant: 'acme', app: 'cashier' }), 'acme-preview');
  assert.equal(defaultProfile({ tenant: 'acme' }), 'acme-preview');
  assert.equal(defaultChannel({ tenant: SHARED_TENANT_ID, app: 'shopper' }), 'generic-shopper-preview');
  assert.equal(defaultProfile({ tenant: SHARED_TENANT_ID }), 'preview');
});

test('checkProfile catches a profile that belongs to a different shop', () => {
  const rendered = JSON.parse(renderEasConfig(JSON.stringify(eas), 'cashier'));
  const wrong = checkProfile({ easJson: rendered, profileName: 'palmart-preview', tenant: 'acme', app: 'cashier', knownTenants: ['palmart', 'acme'] });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.problems.length, 2); // bound to palmart, and palmart's channel
  const right = checkProfile({ easJson: rendered, profileName: 'palmart-preview', tenant: 'palmart', app: 'cashier', knownTenants: ['palmart'] });
  assert.deepEqual(right, { ok: true, problems: [], channel: 'palmart-preview' });
  const forShopper = JSON.parse(renderEasConfig(JSON.stringify(eas), 'shopper'));
  // the white-label publish workflow's profile, for any shop
  assert.equal(checkProfile({ easJson: forShopper, profileName: 'tenant-preview', tenant: 'acme', app: 'shopper', knownTenants: ['palmart', 'acme'] }).ok, true);
  // the generic build must not use a profile bound to a shop
  assert.equal(checkProfile({ easJson: forShopper, profileName: 'palmart', tenant: SHARED_TENANT_ID, app: 'shopper' }).ok, false);
  assert.equal(checkProfile({ easJson: forShopper, profileName: 'preview', tenant: SHARED_TENANT_ID, app: 'shopper' }).ok, true);
  // …and each app's copy carries that app's own channel
  assert.equal(checkProfile({ easJson: rendered, profileName: 'preview', tenant: SHARED_TENANT_ID, app: 'shopper' }).ok, false);
});

test('_shared can never be a real shop slug', () => {
  assert.equal(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(SHARED_TENANT_ID), false);
});

// ── resolved config ─────────────────────────────────────────────────────────

function cleanConfig(app) {
  return {
    name: `Kiosk Ke ${app}`,
    slug: `kiosk-${app}`,
    version: '0.0.1',
    scheme: expectedSchemes(app),
    runtimeVersion: { policy: 'appVersion' },
    updates: { url: `https://u.expo.dev/${PROJECT}` },
    icon: './assets/icon.png',
    splash: { image: './assets/splash.png', backgroundColor: '#28a745' },
    ios: { bundleIdentifier: `com.kioskke.${app}` },
    android: { package: `com.kioskke.${app}`, adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png' } },
    web: { favicon: './assets/favicon.png' },
    extra: { apiBaseURL: 'https://api.kiosk.ke', eas: { projectId: PROJECT } },
  };
}

const neutralHashes = { './assets/icon.png': 'a1', './assets/splash.png': 'a2', './assets/adaptive-icon.png': 'a3', './assets/favicon.png': 'a4' };
const check = (app, expo, over = {}) =>
  checkResolvedConfig({
    app,
    expo,
    hashOf: (rel) => neutralHashes[rel] ?? null,
    palmartHashes: new Map([['p1', 'icon.png']]),
    tenantProjectIds: new Map(),
    ...over,
  });
const ids = (findings) => findings.map((f) => f.id).sort();

test('a clean generic config passes for every app', () => {
  for (const app of ['shopper', 'cashier', 'grocery', 'admin', 'stock']) {
    assert.deepEqual(check(app, cleanConfig(app)), [], app);
  }
});

test('only the Shopper may keep kiosk://', () => {
  assert.deepEqual(expectedSchemes('shopper'), ['kioskshopper', 'kiosk']);
  assert.deepEqual(expectedSchemes('cashier'), ['kioskcashier']);
  assert.deepEqual(ids(check('cashier', { ...cleanConfig('cashier'), scheme: ['kioskcashier', 'kiosk'] })), ['scheme']);
  assert.deepEqual(ids(check('cashier', { ...cleanConfig('cashier'), scheme: 'kiosk' })), ['scheme']);
  assert.deepEqual(ids(check('shopper', { ...cleanConfig('shopper'), scheme: ['kioskshopper'] })), ['scheme']);
});

test('Palmart anywhere in the config is a failure, with its path', () => {
  const expo = cleanConfig('shopper');
  expo.name = 'Palmart';
  expo.plugins = [['expo-camera', { cameraPermission: 'Allow Palmart to use your camera' }]];
  const found = check('shopper', expo).filter((f) => f.id === 'palmart-in-config');
  assert.equal(found.length, 2);
  assert.match(found[1].message, /plugins\[0\]\[1\]\.cameraPermission/);
});

test('a generic build must not carry white-label flags', () => {
  const expo = cleanConfig('cashier');
  expo.extra = { ...expo.extra, isWhiteLabel: true, embeddedTenantSlug: 'acme', tenantId: 'acme' };
  const [finding, ...rest] = check('cashier', expo);
  assert.equal(rest.length, 0);
  assert.match(finding.message, /isWhiteLabel/);
});

test('no Expo project is a failure only the owner can clear', () => {
  const expo = cleanConfig('grocery');
  delete expo.updates;
  delete expo.extra.eas;
  const [finding, ...rest] = check('grocery', expo);
  assert.equal(rest.length, 0);
  assert.equal(finding.id, 'expo-project');
  assert.equal(finding.blockedOn, 'owner');
  assert.match(finding.message, /pnpm eas:init _shared grocery/);
});

test('a generic app may not share an Expo project with a shop', () => {
  const found = check('shopper', cleanConfig('shopper'), { tenantProjectIds: new Map([[PROJECT, 'palmart/shopper']]) });
  assert.deepEqual(ids(found), ['expo-project-shared']);
  assert.equal(found[0].blockedOn, undefined);
});

test('updates.url must match the project id', () => {
  const expo = cleanConfig('stock');
  expo.updates = { url: 'https://u.expo.dev/99999999-2222-3333-4444-555555555555' };
  assert.deepEqual(ids(check('stock', expo)), ['updates-url']);
  delete expo.updates;
  assert.deepEqual(ids(check('stock', expo)), ['updates-url']);
});

test('runtimeVersion and bundle ids are held to the platform values', () => {
  const expo = cleanConfig('admin');
  delete expo.runtimeVersion;
  expo.android.package = 'com.palmart.admin';
  const got = ids(check('admin', expo));
  assert.deepEqual(got, ['bundle-ids', 'palmart-in-config', 'runtime-version']);
});

test('assets: Palmart\'s bytes, missing files and unset paths all fail', () => {
  const copied = check('shopper', cleanConfig('shopper'), { hashOf: (rel) => (rel === './assets/icon.png' ? 'p1' : neutralHashes[rel]) });
  assert.deepEqual(ids(copied), ['assets']);
  assert.match(copied[0].message, /Palmart's icon\.png byte for byte/);
  const missing = check('shopper', cleanConfig('shopper'), { hashOf: () => null });
  assert.equal(missing.filter((f) => f.id === 'assets').length, 4);
  const unset = cleanConfig('shopper');
  delete unset.web;
  assert.deepEqual(ids(check('shopper', unset)), ['assets']);
});

// ── shared profile ──────────────────────────────────────────────────────────

function sharedProfile() {
  const apps = {};
  for (const app of ['shopper', 'cashier', 'grocery', 'admin', 'stock']) {
    apps[app] = { name: `Kiosk Ke ${app}`, expoSlug: `kiosk-${app}`, iosBundleId: `com.kioskke.${app}`, androidPackage: `com.kioskke.${app}` };
  }
  return { id: SHARED_TENANT_ID, marketplace: true, displayName: 'Kiosk', apiBaseUrl: 'https://api.kiosk.ke', apps };
}

test('the shared profile must brand the listing without embedding a tenant', () => {
  assert.deepEqual(checkSharedProfile(sharedProfile()), []);
  assert.equal(checkSharedProfile(null)[0].id, 'shared-profile');
  assert.equal(checkSharedProfile({ ...sharedProfile(), marketplace: false }).length, 1);
  assert.equal(checkSharedProfile({ ...sharedProfile(), embeddedTenantSlug: 'acme' }).length, 1);
  const wrongBundle = sharedProfile();
  wrongBundle.apps.cashier.androidPackage = 'com.palmart.cashier';
  assert.equal(checkSharedProfile(wrongBundle).length, 2); // wrong bundle, and the word Palmart
});

// ── source scan ─────────────────────────────────────────────────────────────

test('source: a match outside the allow-list fails, inside it passes', () => {
  const list = [{ file: 'a/keys.ts', match: /palmart\.shopper\./, reason: 'migration' }];
  const files = [
    { path: 'a/keys.ts', text: "const KEY = 'palmart.shopper.profile';\nconst ok = 1;" },
    { path: 'a/screen.tsx', text: '<Text>\n  Palmart member\n</Text>' },
  ];
  const found = scanSource({ files, allowList: list });
  assert.equal(found.length, 1);
  assert.equal(found[0].id, 'palmart-in-source');
  assert.match(found[0].message, /^a\/screen\.tsx:2 /);
});

test('source: an allow-list entry that matches nothing fails', () => {
  const found = scanSource({ files: [{ path: 'a/b.ts', text: 'nothing here' }], allowList: [{ file: 'a/b.ts', match: /palmart/i, reason: 'x' }] });
  assert.deepEqual(ids(found), ['allow-list']);
});

test('source: an allow-list entry applies only to its own file', () => {
  const found = scanSource({
    files: [{ path: 'other.ts', text: "const k = 'palmart.shopper.profile';" }],
    allowList: [{ file: 'a/keys.ts', match: /palmart\.shopper\./, reason: 'migration' }],
  });
  assert.deepEqual(ids(found), ['allow-list', 'palmart-in-source']);
});

test('every real allow-list entry states a reason and a file', () => {
  for (const entry of allowList) {
    assert.ok(entry.file && entry.match instanceof RegExp && entry.reason.length > 20, entry.file);
  }
});

// ── eas.json ────────────────────────────────────────────────────────────────

const template = JSON.stringify(eas, null, 2) + '\n';
const copiesOf = (text) => Object.fromEntries(['shopper', 'cashier', 'grocery', 'admin', 'stock'].map((app) => [app, renderEasConfig(text, app)]));

test('eas.json: rendered copies and well-formed channels pass', () => {
  assert.deepEqual(checkEas({ templateText: template, copies: copiesOf(template), knownTenants: ['palmart'] }), []);
});

test('eas.json: a stale or missing copy fails', () => {
  const copies = copiesOf(template);
  copies.cashier = copies.cashier.replace('generic-cashier-production', 'production');
  copies.stock = null;
  assert.deepEqual(ids(checkEas({ templateText: template, copies, knownTenants: ['palmart'] })), ['eas-channel', 'eas-copy', 'eas-copy']);
});

test('eas.json: a bare "production" channel, a wrong prefix and an unknown tenant fail', () => {
  const bad = JSON.parse(template);
  bad.build.production.channel = 'production';
  bad.build.palmart.channel = 'preview';
  bad.build.acme = { extends: 'production', channel: 'acme-production', env: { TENANT_ID: 'acme' } };
  const text = JSON.stringify(bad, null, 2) + '\n';
  const found = checkEas({ templateText: text, copies: copiesOf(text), knownTenants: ['palmart'] });
  assert.ok(found.length >= 3);
  assert.ok(found.some((f) => /bound to "acme"/.test(f.message)));
  assert.ok(found.some((f) => /does not start with "palmart-"/.test(f.message)));
});

test('eas.json: a tenant-neutral profile must stay in the tenant- namespace', () => {
  const bad = JSON.parse(template);
  bad.build['tenant-preview'].channel = 'preview';
  const text = JSON.stringify(bad, null, 2) + '\n';
  const found = checkEas({ templateText: text, copies: copiesOf(text), knownTenants: ['palmart'] });
  assert.ok(found.some((f) => /tenant-neutral profile "tenant-preview"/.test(f.message)));
});

test('asset copies: a stale app copy fails', () => {
  assert.deepEqual(checkAssetCopies([{ app: 'cashier', file: 'icon.png', appHash: 'x', sharedHash: 'x' }]), []);
  const found = checkAssetCopies([{ app: 'cashier', file: 'icon.png', appHash: 'x', sharedHash: 'y' }]);
  assert.equal(found[0].id, 'asset-copy');
});

// ── classifying findings ────────────────────────────────────────────────────

const OWNER_FINDING = { level: 'fail', id: 'expo-project', message: 'cashier: no Expo project', blockedOn: 'owner' };
const CODE_FINDING = { level: 'fail', id: 'asset-copy', message: 'stale copy' };
const WARNING = { level: 'warn', id: 'white-label-scheme', message: 'deferred' };

test('classify: by default every failure fails, including the ones only the owner can clear', () => {
  const { failures, pending, warnings } = classify([OWNER_FINDING, CODE_FINDING, WARNING]);
  assert.deepEqual(failures, [OWNER_FINDING, CODE_FINDING]);
  assert.deepEqual(pending, []);
  assert.deepEqual(warnings, [WARNING]);
});

test('classify: allowOwnerBlocked parks the owner-only findings, and nothing else', () => {
  const { failures, pending, warnings } = classify([OWNER_FINDING, CODE_FINDING, WARNING], { allowOwnerBlocked: true });
  assert.deepEqual(failures, [CODE_FINDING], 'a code problem still fails');
  assert.deepEqual(pending, [OWNER_FINDING]);
  assert.deepEqual(warnings, [WARNING]);
});

test('classify: with only owner-blocked findings and the flag, the run passes', () => {
  assert.equal(classify([OWNER_FINDING], { allowOwnerBlocked: true }).failures.length, 0);
  assert.equal(classify([OWNER_FINDING]).failures.length, 1);
});
