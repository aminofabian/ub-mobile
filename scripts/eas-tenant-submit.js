#!/usr/bin/env node
/**
 * Submit the latest EAS build to App Store / Play Store.
 * Usage: node scripts/eas-tenant-submit.js <app> [profile] [platform]
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { easBin, easEnv } = require('./eas-cli');

const app = process.argv[2]?.trim();
const profile = process.argv[3]?.trim() || 'palmart';
const platform = process.argv[4]?.trim() || 'android';

const apps = new Set(['cashier', 'shopper', 'grocery', 'admin', 'stock']);
const platforms = new Set(['android', 'ios']);

if (!app || !apps.has(app)) {
  console.error('Usage: node scripts/eas-tenant-submit.js <app> [profile] [platform]');
  console.error('Example: node scripts/eas-tenant-submit.js cashier palmart android');
  process.exit(1);
}

if (!platforms.has(platform)) {
  console.error(`Platform must be android or ios (got "${platform}").`);
  process.exit(1);
}

const mobileRoot = path.join(__dirname, '..');
const appDir = path.join(mobileRoot, 'apps', app);

if (platform === 'android') {
  const gsa = path.join(mobileRoot, 'google-service-account.json');
  if (!fs.existsSync(gsa)) {
    console.error(`Missing ${path.relative(mobileRoot, gsa)}.`);
    console.error(
      'Download a Play Console API service-account JSON and place it there, then retry.',
    );
    console.error('Or upload the AAB by hand from the Expo build page.');
    process.exit(1);
  }
}

require('./sync-eas-config.js');

const result = spawnSync(
  easBin(),
  [
    'submit',
    '--profile',
    profile,
    '--platform',
    platform,
    '--latest',
    '--non-interactive',
  ],
  {
    cwd: appDir,
    env: easEnv(),
    stdio: 'inherit',
    shell: false,
  }
);

process.exit(result.status ?? 1);
