#!/usr/bin/env node
/**
 * EAS cloud build for a white-label tenant app.
 * Usage: node scripts/eas-tenant-build.js <tenant> <app> [platform]
 * Example: node scripts/eas-tenant-build.js palmart cashier all
 */
const { spawnSync } = require('child_process');
const path = require('path');
const { easBin } = require('./eas-cli');

const tenant = process.argv[2]?.trim();
const app = process.argv[3]?.trim();
const platform = process.argv[4]?.trim() || 'all';
const profile = process.argv[5]?.trim() || 'tenant-production';

const apps = new Set(['cashier', 'shopper', 'grocery', 'admin', 'stock']);

if (!tenant || !app || !apps.has(app)) {
  console.error('Usage: node scripts/eas-tenant-build.js <tenant> <app> [platform] [profile]');
  console.error('Example: node scripts/eas-tenant-build.js palmart cashier all palmart');
  process.exit(1);
}

const mobileRoot = path.join(__dirname, '..');
const appDir = path.join(mobileRoot, 'apps', app);

require('./sync-eas-config.js');

const result = spawnSync(
  easBin(),
  ['build', '--profile', profile, '--platform', platform, '--non-interactive'],
  {
    cwd: appDir,
    env: {
      ...process.env,
      KIOSK_TENANT: tenant,
      TENANT_ID: tenant,
      NODE_ENV: 'production',
    },
    stdio: 'inherit',
    shell: false,
  }
);

process.exit(result.status ?? 1);
