#!/usr/bin/env node
/** Copies generated tenant assets into each app's assets/ folder for generic (non-white-label) dev builds. */
const fs = require('fs');
const path = require('path');

const mobileRoot = path.join(__dirname, '..');
const sourceDir = path.join(mobileRoot, 'tenants', 'palmart', 'assets');
const files = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];
const apps = ['cashier', 'shopper', 'grocery', 'admin', 'stock'];

if (!fs.existsSync(sourceDir)) {
  console.error('Run: node scripts/generate-tenant-assets.js palmart');
  process.exit(1);
}

for (const app of apps) {
  const destDir = path.join(mobileRoot, 'apps', app, 'assets');
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of files) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(destDir, file));
  }
  console.log(`Synced default assets → apps/${app}/assets/`);
}
