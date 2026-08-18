#!/usr/bin/env node
/**
 * Submit the latest EAS build to App Store / Play Store.
 * Usage: node scripts/eas-tenant-submit.js <app> [profile]
 */
const { spawnSync } = require('child_process');
const path = require('path');
const { easBin, easEnv } = require('./eas-cli');

const app = process.argv[2]?.trim();
const profile = process.argv[3]?.trim() || 'palmart';

const apps = new Set(['cashier', 'shopper', 'grocery', 'admin', 'stock']);

if (!app || !apps.has(app)) {
  console.error('Usage: node scripts/eas-tenant-submit.js <app> [profile]');
  console.error('Example: node scripts/eas-tenant-submit.js cashier palmart');
  process.exit(1);
}

const mobileRoot = path.join(__dirname, '..');
const appDir = path.join(mobileRoot, 'apps', app);

require('./sync-eas-config.js');

const result = spawnSync(
  easBin(),
  ['submit', '--profile', profile, '--latest', '--non-interactive'],
  {
    cwd: appDir,
    env: easEnv(),
    stdio: 'inherit',
    shell: false,
  }
);

process.exit(result.status ?? 1);
