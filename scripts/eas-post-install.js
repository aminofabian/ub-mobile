#!/usr/bin/env node
/**
 * EAS hook: build workspace packages this app depends on (tsup dist/).
 * Runs after pnpm install on EAS so Metro can resolve @kiosk/* without
 * relying on locally generated dist folders.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const appPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const mobileRoot = path.join(__dirname, '..');

const result = spawnSync(
  'pnpm',
  ['exec', 'turbo', 'run', 'build', `--filter=${appPkg.name}^...`],
  {
    cwd: mobileRoot,
    stdio: 'inherit',
    shell: false,
  },
);

process.exit(result.status ?? 1);
