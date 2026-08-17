#!/usr/bin/env node
/**
 * Writes an API-exported tenant profile to mobile/tenants/{slug}/config.json.
 * Usage:
 *   node scripts/install-tenant-profile.js path/to/profile.json
 *   cat profile.json | node scripts/install-tenant-profile.js
 */
const fs = require('fs');
const path = require('path');

const mobileRoot = path.join(__dirname, '..');
const tenantsDir = path.join(mobileRoot, 'tenants');

function readInput(fileArg) {
  if (fileArg && fileArg !== '-') {
    const filePath = path.resolve(process.cwd(), fileArg);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  const chunks = [];
  const fd = fs.openSync(0, 'rs');
  const buffer = Buffer.alloc(64 * 1024);
  let bytes = 0;
  while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
    chunks.push(buffer.subarray(0, bytes));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    throw new Error('No profile JSON on stdin. Pass a file path or pipe JSON.');
  }
  return JSON.parse(raw);
}

function toTenantProfile(exportProfile) {
  const slug = exportProfile.slug?.trim();
  if (!slug) {
    throw new Error('Profile is missing slug');
  }

  const assetBase = exportProfile.assets?.icon
    ? path.dirname(exportProfile.assets.icon)
    : `../../tenants/${slug}/assets`;

  const assetPaths = {
    icon: `${assetBase}/icon.png`,
    splashImage: `${assetBase}/splash.png`,
    adaptiveIcon: `${assetBase}/adaptive-icon.png`,
    favicon: `${assetBase}/favicon.png`,
  };

  const apps = {};
  for (const [role, app] of Object.entries(exportProfile.apps || {})) {
    apps[role] = {
      name: app.name,
      expoSlug: app.expoSlug || `${slug}-${role}`,
      bundleId: app.bundleId,
      icon: assetPaths.icon,
      splashImage: assetPaths.splashImage,
      adaptiveIcon: assetPaths.adaptiveIcon,
      splashBackgroundColor: exportProfile.splashBackgroundColor ?? '#28a745',
    };
  }

  return {
    slug,
    displayName: exportProfile.displayName || slug,
    tenantHostSuffix: exportProfile.tenantHostSuffix || undefined,
    apiBaseURL: exportProfile.apiBaseURL,
    splashBackgroundColor: exportProfile.splashBackgroundColor ?? '#28a745',
    primaryColor: exportProfile.primaryColor ?? exportProfile.splashBackgroundColor ?? '#28a745',
    scheme: exportProfile.scheme || slug,
    apps,
    assets: assetPaths,
  };
}

function main() {
  const fileArg = process.argv[2];
  const exportProfile = readInput(fileArg);
  const profile = toTenantProfile(exportProfile);
  const tenantId = profile.slug;
  const outDir = path.join(tenantsDir, tenantId, 'assets', 'source');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(tenantsDir, tenantId, 'config.json');
  fs.writeFileSync(outPath, `${JSON.stringify(profile, null, 2)}\n`);
  console.log(`Installed tenant profile → ${path.relative(mobileRoot, outPath)}`);
  return tenantId;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { toTenantProfile, main };
