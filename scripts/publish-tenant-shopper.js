#!/usr/bin/env node
/**
 * Local / CI pipeline: install tenant profile → generate assets → EAS build (shopper).
 * Usage: node scripts/publish-tenant-shopper.js tenants/acme.json [platform] [profile]
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const profileArg = process.argv[2]?.trim();
const platform = process.argv[3]?.trim() || 'all';
const profile = process.argv[4]?.trim() || 'tenant-production';

if (!profileArg) {
  console.error('Usage: node scripts/publish-tenant-shopper.js <profile.json> [platform] [eas-profile]');
  process.exit(1);
}

const mobileRoot = path.join(__dirname, '..');
const profilePath = path.isAbsolute(profileArg)
  ? profileArg
  : path.resolve(mobileRoot, profileArg);
const installScript = path.join(__dirname, 'install-tenant-profile.js');
const assetsScript = path.join(__dirname, 'generate-tenant-assets.js');
const buildScript = path.join(__dirname, 'eas-tenant-build.js');

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: mobileRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const install = spawnSync(process.execPath, [installScript, profilePath], {
  cwd: mobileRoot,
  encoding: 'utf8',
});
if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

const exportProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const tenantId = exportProfile.slug?.trim();
if (!tenantId) {
  console.error('Profile JSON must include slug');
  process.exit(1);
}

console.log(`\n→ Generating assets for ${tenantId} (continues if source art is missing)…`);
const assets = spawnSync(process.execPath, [assetsScript, tenantId], {
  cwd: mobileRoot,
  stdio: 'inherit',
});
if (assets.status !== 0) {
  console.warn(
    '\nAsset generation failed — add mobile/tenants/' +
      tenantId +
      '/assets/source/icon-source.png and re-run, or continue with placeholders.\n'
  );
}

console.log(`\n→ Starting EAS build (${profile}, ${platform})…`);
runNode(buildScript, [tenantId, 'shopper', platform, profile]);
