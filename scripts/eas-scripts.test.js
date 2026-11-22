// node --test scripts/eas-scripts.test.js
//
// The tenant build and update scripts must refuse a wrong channel or profile BEFORE they write a file or
// start EAS. Only refusals are run here: a passing request would call EAS for real. The rules themselves
// (including every accepted case) are covered in check-generic-config.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const mobileRoot = path.join(__dirname, '..');
const watched = ['shopper', 'cashier'].map((app) => path.join(mobileRoot, 'apps', app, 'eas.json'));

function run(script, args) {
  const before = watched.map((file) => fs.statSync(file).mtimeMs);
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: mobileRoot,
    encoding: 'utf8',
    // No tenant from the surrounding shell, and no way to reach EAS if a refusal were to fail open.
    env: { PATH: process.env.PATH, HOME: process.env.HOME, EAS_NO_VCS: '1' },
  });
  const after = watched.map((file) => fs.statSync(file).mtimeMs);
  return { ...result, touched: before.some((value, index) => value !== after[index]) };
}

function refuses(result, pattern) {
  assert.equal(result.status, 1, `expected exit 1, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, pattern);
  assert.equal(result.touched, false, 'a refusal must not rewrite eas.json');
  assert.doesNotMatch(result.stdout, /Synced eas\.json/);
}

test('update: a shop cannot publish to a generic channel', () => {
  refuses(run('eas-tenant-update.js', ['palmart', 'cashier', 'generic-cashier-preview', 'x']), /generic-build channel/);
});

test('update: the generic app cannot publish to a shop channel', () => {
  refuses(run('eas-tenant-update.js', ['_shared', 'cashier', 'palmart-preview', 'x']), /generic cashier must use a channel starting "generic-cashier-"/);
});

test("update: the generic app cannot publish to another app's channel", () => {
  refuses(run('eas-tenant-update.js', ['_shared', 'cashier', 'generic-shopper-preview', 'x']), /generic-cashier-/);
});

test('update: a shop cannot publish to another shop\'s channel', () => {
  refuses(run('eas-tenant-update.js', ['fresh', 'shopper', 'palmart-preview', 'x']), /belongs to palmart, not fresh/);
});

test('build: a shop cannot build the generic profile', () => {
  refuses(run('eas-tenant-build.js', ['palmart', 'cashier', 'android', 'preview']), /generic-build channel/);
});

test("build: the generic app cannot build a shop's profile", () => {
  refuses(run('eas-tenant-build.js', ['_shared', 'cashier', 'android', 'palmart-preview']), /bound to tenant "palmart", not "_shared"/);
});

test("build: one shop cannot build another shop's profile", () => {
  refuses(run('eas-tenant-build.js', ['fresh', 'cashier', 'android', 'palmart-preview']), /bound to tenant "palmart", not "fresh"/);
});

test('build: an unknown profile is refused with its name', () => {
  refuses(run('eas-tenant-build.js', ['palmart', 'cashier', 'android', 'nope']), /no build profile "nope"/);
});

test('build: a shop named after a reserved namespace is refused', () => {
  refuses(run('eas-tenant-build.js', ['tenant', 'cashier', 'android', 'tenant-production']), /reserved/);
});
