#!/usr/bin/env node
/**
 * Link an app to an Expo EAS project for a tenant.
 * Usage: node scripts/eas-tenant-init.js <tenant> <app>
 * Example: node scripts/eas-tenant-init.js palmart cashier
 *
 * Creates (or links) the Expo project using the white-label slug, then stores
 * extra.eas.projectId on the tenant profile instead of generic app.json.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { easBin, mobileRoot } = require('./eas-cli');

const tenant = process.argv[2]?.trim();
const app = process.argv[3]?.trim();
const apps = new Set(['cashier', 'shopper', 'grocery', 'admin', 'stock']);

if (!tenant || !app || !apps.has(app)) {
  console.error('Usage: node scripts/eas-tenant-init.js <tenant> <app>');
  console.error('Example: node scripts/eas-tenant-init.js palmart cashier');
  process.exit(1);
}

const root = mobileRoot();
const appDir = path.join(root, 'apps', app);
const appJsonPath = path.join(appDir, 'app.json');
const tenantConfigPath = path.join(root, 'tenants', tenant, 'config.json');
const tenantLegacyPath = path.join(root, 'tenants', `${tenant}.json`);
const profilePath = fs.existsSync(tenantConfigPath)
  ? tenantConfigPath
  : tenantLegacyPath;

if (!fs.existsSync(profilePath)) {
  console.error(`Missing tenant profile: ${profilePath}`);
  process.exit(1);
}

require('./sync-eas-config.js');

const before = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const beforeProjectId = before.expo?.extra?.eas?.projectId ?? null;

console.log(`Linking ${tenant}/${app} with EAS (slug from tenants/${tenant})…`);
const result = spawnSync(easBin(), ['init'], {
  cwd: appDir,
  env: {
    ...process.env,
    KIOSK_TENANT: tenant,
    TENANT_ID: tenant,
  },
  stdio: 'inherit',
  shell: false,
});

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

const after = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const projectId = after.expo?.extra?.eas?.projectId?.trim() || null;
if (!projectId) {
  console.error(
    'eas init finished but app.json has no extra.eas.projectId. Run `eas whoami` then retry.',
  );
  process.exit(1);
}

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
profile.apps = profile.apps ?? {};
profile.apps[app] = { ...(profile.apps[app] ?? {}), easProjectId: projectId };
fs.writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
console.log(`Saved easProjectId → ${path.relative(root, profilePath)} apps.${app}`);

if (!beforeProjectId) {
  if (after.expo?.extra?.eas) {
    delete after.expo.extra.eas;
    if (Object.keys(after.expo.extra).length === 0) {
      delete after.expo.extra;
    }
    fs.writeFileSync(appJsonPath, `${JSON.stringify(after, null, 2)}\n`);
    console.log('Removed projectId from generic app.json (kept on the tenant profile).');
  }
}

console.log(`Expo project: https://expo.dev/accounts/_/projects (id ${projectId})`);
console.log(`Next: pnpm eas:build:tenant ${tenant} ${app} android palmart-preview`);
