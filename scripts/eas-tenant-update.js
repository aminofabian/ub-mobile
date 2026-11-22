#!/usr/bin/env node
/**
 * Publish a JS-only OTA update (does not consume EAS Build quota).
 * Usage: node scripts/eas-tenant-update.js <tenant> <app> [channel] [message]
 * Example: node scripts/eas-tenant-update.js palmart cashier palmart-preview "Fix PIN login"
 *          node scripts/eas-tenant-update.js _shared shopper generic-shopper-preview "Fix PIN login"
 *
 * The channel is checked first (scripts/lib/channel-guard.js): an update for a shop cannot go out on
 * a generic channel, nor the generic app's on a shop's.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const { easBin, easEnv } = require('./eas-cli');
const { defaultChannel, checkChannel } = require('./lib/channel-guard');
const { listTenantIds } = require('../load-tenant-profile');

const tenant = process.argv[2]?.trim();
const app = process.argv[3]?.trim();
const channel = process.argv[4]?.trim() || (tenant && app ? defaultChannel({ tenant, app }) : '');
const message = process.argv.slice(5).join(' ').trim() || `OTA ${tenant}/${app} ${new Date().toISOString()}`;

const apps = new Set(['cashier', 'shopper', 'grocery', 'admin', 'stock']);

if (!tenant || !app || !apps.has(app)) {
  console.error('Usage: node scripts/eas-tenant-update.js <tenant> <app> [channel] [message]');
  console.error('Example: node scripts/eas-tenant-update.js palmart cashier palmart-preview "Fix PIN login"');
  process.exit(1);
}

const verdict = checkChannel({ tenant, app, channel, knownTenants: listTenantIds() });
if (!verdict.ok) {
  console.error(`Refusing to publish ${tenant}/${app} to "${channel}": ${verdict.reason}.`);
  process.exit(1);
}

const appDir = path.join(__dirname, '..', 'apps', app);
require('./sync-eas-config.js');

const result = spawnSync(
  easBin(),
  ['update', '--channel', channel, '--message', message, '--non-interactive'],
  {
    cwd: appDir,
    env: easEnv({
      KIOSK_TENANT: tenant,
      TENANT_ID: tenant,
    }),
    stdio: 'inherit',
    shell: false,
  },
);

process.exit(result.status ?? 1);
