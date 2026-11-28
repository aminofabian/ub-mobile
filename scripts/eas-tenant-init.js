#!/usr/bin/env node
/**
 * Link an app to an Expo EAS project for a tenant.
 * Usage: node scripts/eas-tenant-init.js <tenant> <app>
 * Example: node scripts/eas-tenant-init.js palmart cashier
 *
 * Creates (or links) the Expo project using the white-label slug, then stores
 * easProjectId on the tenant profile instead of generic app.json.
 *
 * With app.config.js, `eas init` creates the Expo project but cannot write
 * projectId into the dynamic config (non-zero exit). We still scrape the id
 * from its output and save it on the tenant profile.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { easBin, easEnv, mobileRoot } = require('./eas-cli');

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

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
const result = spawnSync(easBin(), ['init', '--non-interactive', '--force'], {
  cwd: appDir,
  env: easEnv({
    KIOSK_TENANT: tenant,
    TENANT_ID: tenant,
  }),
  encoding: 'utf8',
  shell: false,
});

const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
if (combined.trim()) {
  process.stdout.write(combined.endsWith('\n') ? combined : `${combined}\n`);
}

function projectIdFromText(text) {
  const labeled =
    text.match(/"projectId"\s*:\s*"([^"]+)"/i) ||
    text.match(/projectId["']?\s*[:=]\s*["']?([0-9a-f-]{36})/i);
  if (labeled?.[1] && UUID_RE.test(labeled[1])) {
    return labeled[1];
  }
  const created = text.match(
    /Created @[^\s/]+\/[^\s:]+:\s*https:\/\/expo\.dev\/[^\s]+/i,
  );
  if (created) {
    // Id is printed in the follow-up JSON block, not the URL slug.
  }
  const all = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  );
  return all?.[all.length - 1] ?? null;
}

const after = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
let projectId =
  after.expo?.extra?.eas?.projectId?.trim() ||
  process.env.EXPO_PROJECT_ID?.trim() ||
  projectIdFromText(combined) ||
  null;

const dynamicConfigWriteFailed = /Cannot automatically write to dynamic config/i.test(
  combined,
);

if ((result.status ?? 1) !== 0 && !(dynamicConfigWriteFailed && projectId)) {
  console.error(
    projectId
      ? 'eas init failed after creating a project; project id was parsed but the command exited non-zero.'
      : 'eas init failed and no project id could be recovered. Run `eas whoami` then retry.',
  );
  process.exit(result.status ?? 1);
}

if (!projectId) {
  console.error(
    'eas init finished but no project id was found (common with app.config.js).',
  );
  console.error(
    `Re-run with EXPO_PROJECT_ID=<uuid> pnpm eas:init ${tenant} ${app}`,
  );
  process.exit(1);
}

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
profile.apps = profile.apps ?? {};
profile.apps[app] = { ...(profile.apps[app] ?? {}), easProjectId: projectId };
fs.writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
console.log(`Saved easProjectId → ${path.relative(root, profilePath)} apps.${app}`);

if (!beforeProjectId && after.expo?.extra?.eas) {
  delete after.expo.extra.eas;
  if (Object.keys(after.expo.extra).length === 0) {
    delete after.expo.extra;
  }
  fs.writeFileSync(appJsonPath, `${JSON.stringify(after, null, 2)}\n`);
  console.log('Removed projectId from generic app.json (kept on the tenant profile).');
}

if (dynamicConfigWriteFailed) {
  console.log(
    'Note: eas init could not write into app.config.js — project id is on the tenant profile only.',
  );
}

console.log(`Expo project: https://expo.dev/accounts/_/projects (id ${projectId})`);
console.log(`Next: pnpm eas:build:tenant ${tenant} ${app} android palmart-preview`);
