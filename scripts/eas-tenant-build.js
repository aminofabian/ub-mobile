#!/usr/bin/env node
/**
 * EAS cloud build for a white-label tenant app.
 * Usage: node scripts/eas-tenant-build.js <tenant> <app> [platform] [profile]
 * Example: node scripts/eas-tenant-build.js palmart cashier android palmart-preview
 *          node scripts/eas-tenant-build.js _shared shopper android preview   (the generic Kiosk app)
 *
 * The profile's channel and tenant binding are checked first (scripts/lib/channel-guard.js): a shop
 * cannot build on a generic channel, the generic app cannot build on a shop's, and a profile bound
 * to one shop cannot build another's.
 *
 * Free plan: 15 Android + 15 iOS builds/month, 1 concurrent, 45 min timeout.
 * Default platform is android. JS-only changes should use eas:update:tenant.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { easBin, easEnv } = require('./eas-cli');
const { defaultProfile, renderEasConfig, checkProfile } = require('./lib/channel-guard');
const { listTenantIds } = require('../load-tenant-profile');

const tenant = process.argv[2]?.trim();
const app = process.argv[3]?.trim();
const platform = process.argv[4]?.trim() || 'android';
const profile = process.argv[5]?.trim() || (tenant ? defaultProfile({ tenant }) : '');

const apps = new Set(['cashier', 'shopper', 'grocery', 'admin', 'stock']);
const platforms = new Set(['android', 'ios', 'all']);

if (!tenant || !app || !apps.has(app)) {
  console.error('Usage: node scripts/eas-tenant-build.js <tenant> <app> [platform] [profile]');
  console.error('Example: node scripts/eas-tenant-build.js palmart cashier android palmart-preview');
  process.exit(1);
}

if (!platforms.has(platform)) {
  console.error(`Platform must be android, ios, or all (got "${platform}").`);
  process.exit(1);
}

if (platform === 'all' && process.env.EAS_ALLOW_ALL_PLATFORMS !== '1') {
  console.error(
    'Refusing platform "all": the Expo Free plan counts Android and iOS separately (15 each / month).',
  );
  console.error('Pass android or ios. To override: EAS_ALLOW_ALL_PLATFORMS=1');
  process.exit(1);
}

const mobileRoot = path.join(__dirname, '..');
const appDir = path.join(mobileRoot, 'apps', app);

// Check the profile as it will be rendered for this app, before anything is written or uploaded.
const easJson = JSON.parse(
  renderEasConfig(fs.readFileSync(path.join(mobileRoot, 'eas.json'), 'utf8'), app),
);
const verdict = checkProfile({
  easJson,
  profileName: profile,
  tenant,
  app,
  knownTenants: listTenantIds(),
});
if (!verdict.ok) {
  console.error(`Refusing to build ${tenant}/${app}:`);
  for (const problem of verdict.problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

require('./sync-eas-config.js');

const args = ['build', '--profile', profile, '--platform', platform];
// First Android/iOS credentials (keystore / dist cert) must be created interactively.
if (process.env.CI) {
  args.push('--non-interactive');
}
if (process.env.EAS_WAIT !== '1') {
  args.push('--no-wait');
}

console.log(
  `EAS Free plan: native rebuilds are scarce. After this binary exists, prefer:\n` +
    `  pnpm eas:update:tenant ${tenant} ${app} ${verdict.channel} "your message"\n`,
);

const result = spawnSync(easBin(), args, {
  cwd: appDir,
  env: easEnv({
    KIOSK_TENANT: tenant,
    TENANT_ID: tenant,
  }),
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
