#!/usr/bin/env node
/** Copies shared eas.json into each app directory (EAS requires it beside app.config.js). */
const fs = require('fs');
const path = require('path');

const mobileRoot = path.join(__dirname, '..');
const source = path.join(mobileRoot, 'eas.json');
const apps = ['cashier', 'shopper', 'grocery', 'admin', 'stock'];

if (!fs.existsSync(source)) {
  console.error('Missing mobile/eas.json');
  process.exit(1);
}

const body = fs.readFileSync(source, 'utf8');
for (const app of apps) {
  const dest = path.join(mobileRoot, 'apps', app, 'eas.json');
  fs.writeFileSync(dest, body);
  console.log(`Synced eas.json → apps/${app}/`);
}
