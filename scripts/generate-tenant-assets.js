#!/usr/bin/env node
/**
 * Generates Expo asset sizes from tenant source artwork.
 * Usage: node scripts/generate-tenant-assets.js [tenantId]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const { resolveProfilePath } = require('../load-tenant-profile');

const tenantId = process.argv[2]?.trim() || 'palmart';
const mobileRoot = path.join(__dirname, '..');
const profilePath = resolveProfilePath(tenantId);
const assetsDir = path.join(mobileRoot, 'tenants', tenantId, 'assets');
const sourceDir = path.join(assetsDir, 'source');

const CURSOR_ASSETS = path.join(
  process.env.HOME || '',
  '.cursor/projects/Users-mac-02-DEVELOPMENT-01-REPOS-github-com-aminofabian-palmart/assets'
);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyIfMissing(targetName, candidates) {
  const dest = path.join(sourceDir, targetName);
  if (fs.existsSync(dest)) return dest;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      fs.copyFileSync(candidate, dest);
      console.log(`Copied ${path.basename(candidate)} → source/${targetName}`);
      return dest;
    }
  }
  throw new Error(`Missing source art for ${targetName}. Add ${dest} manually.`);
}

async function writePng(buffer, outPath, width, height, background, fit = 'cover') {
  await sharp(buffer)
    .resize(width, height, { fit, background })
    .png()
    .toFile(outPath);
  console.log(`Wrote ${path.relative(mobileRoot, outPath)} (${width}x${height})`);
}

async function main() {
  if (!profilePath) {
    throw new Error(`Tenant profile not found for "${tenantId}". Add tenants/${tenantId}/config.json`);
  }

  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const bg = profile.splashBg ?? profile.splashBackgroundColor ?? '#28a745';

  ensureDir(sourceDir);
  ensureDir(assetsDir);

  const iconSource = copyIfMissing('icon-source.png', [
    path.join(sourceDir, 'icon-source.png'),
    path.join(CURSOR_ASSETS, 'palmart-icon-1024.png'),
  ]);

  const splashSource = copyIfMissing('splash-source.png', [
    path.join(sourceDir, 'splash-source.png'),
    path.join(CURSOR_ASSETS, 'palmart-splash.png'),
    iconSource,
  ]);

  const iconBuffer = await sharp(iconSource).png().toBuffer();
  const splashBuffer = await sharp(splashSource).png().toBuffer();

  await writePng(iconBuffer, path.join(assetsDir, 'icon.png'), 1024, 1024, bg, 'cover');
  await writePng(iconBuffer, path.join(assetsDir, 'adaptive-icon.png'), 1024, 1024, bg, 'cover');
  await writePng(iconBuffer, path.join(assetsDir, 'favicon.png'), 48, 48, bg, 'cover');
  await writePng(splashBuffer, path.join(assetsDir, 'splash.png'), 1284, 2778, bg, 'cover');

  console.log(`Assets ready in ${path.relative(mobileRoot, assetsDir)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
