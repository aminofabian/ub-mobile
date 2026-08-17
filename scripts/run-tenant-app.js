#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const tenant = process.argv[2]?.trim();
const app = process.argv[3]?.trim();

const apps = new Set(['cashier', 'shopper', 'grocery', 'admin', 'stock']);

if (!tenant || !app || !apps.has(app)) {
  console.error('Usage: node scripts/run-tenant-app.js <tenant> <app>');
  console.error('Example: node scripts/run-tenant-app.js palmart cashier');
  process.exit(1);
}

const mobileRoot = path.join(__dirname, '..');
const env = {
  ...process.env,
  KIOSK_TENANT: tenant,
  TENANT_ID: tenant,
};

const child = spawn('pnpm', ['--filter', `@kiosk/${app}`, 'start'], {
  cwd: mobileRoot,
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 1));
