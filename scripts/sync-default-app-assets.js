#!/usr/bin/env node
/**
 * Copies the generic brand assets from tenants/_shared/assets into each app's assets/ folder.
 * app.json points at those copies, and scripts/check-generic-config.js fails when one drifts.
 *
 * The source is the shared profile and never a shop. Copying a shop's art here is how Palmart's icon
 * and splash ended up in the generic apps.
 */
const fs = require('fs');
const path = require('path');

const mobileRoot = path.join(__dirname, '..');
const sourceDir = path.join(mobileRoot, 'tenants', '_shared', 'assets');
const files = ['icon.png', 'adaptive-icon.png', 'favicon.png', 'splash.png'];
const apps = ['cashier', 'shopper', 'grocery', 'admin', 'stock'];

if (!fs.existsSync(sourceDir)) {
  console.error('Missing tenants/_shared/assets. See tenants/_shared/README.md.');
  process.exit(1);
}

/** tenants/_shared/assets/<app>/<file> overrides tenants/_shared/assets/<file> (the Shopper's plain-field splash). */
function sourceFor(app, file) {
  const perApp = path.join(sourceDir, app, file);
  return fs.existsSync(perApp) ? perApp : path.join(sourceDir, file);
}

for (const app of apps) {
  const destDir = path.join(mobileRoot, 'apps', app, 'assets');
  fs.mkdirSync(destDir, { recursive: true });
  // The Shopper's in-app splash stamps brand-mark.png.
  const appFiles = app === 'shopper' ? [...files, 'brand-mark.png'] : files;
  for (const file of appFiles) {
    fs.copyFileSync(sourceFor(app, file), path.join(destDir, file));
  }
  console.log(`Synced default assets → apps/${app}/assets/`);
}
