#!/usr/bin/env node
/**
 * Config guard for the generic (marketplace) build. Plan §5.9, Phase 0a.
 *
 * Resolves each app's app.config.js the way an EAS production build does (EAS_BUILD=true,
 * NODE_ENV=production, no TENANT_ID) and fails when the result carries Palmart, a white-label flag,
 * the wrong scheme, no OTA identity or Palmart's art. It also scans the source for "palmart" outside
 * lib/palmart-allow-list.js, and checks that eas.json and every app's channel belong to the right
 * tenant.
 *
 * Usage: node scripts/check-generic-config.js [--app <app>] [--json] [--allow-owner-blocked]
 * Exit 0 when there are no failures. Warnings never fail the run.
 *
 * --allow-owner-blocked reports the findings only the owner can clear (creating the generic apps'
 * Expo projects) as PEND instead of FAIL, so CI can gate everything else before they exist. Drop
 * the flag once they do.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  APPS,
  classify,
  SOURCE_EXTENSIONS,
  checkAssetCopies,
  checkEas,
  checkResolvedConfig,
  checkSharedProfile,
  scanSource,
  warn,
} = require('./lib/generic-guard');
const allowList = require('./lib/palmart-allow-list');
const { SHARED_TENANT_ID } = require('./lib/channel-guard');

const mobileRoot = path.join(__dirname, '..');
const tenantsDir = path.join(mobileRoot, 'tenants');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function tenantProfile(id) {
  return readJson(path.join(tenantsDir, id, 'config.json'));
}

/** Tenants that have a profile, not counting the shared one. */
function knownTenants() {
  return fs
    .readdirSync(tenantsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== SHARED_TENANT_ID)
    .filter((entry) => fs.existsSync(path.join(tenantsDir, entry.name, 'config.json')))
    .map((entry) => entry.name);
}

function palmartHashes() {
  const hashes = new Map();
  const dir = path.join(tenantsDir, 'palmart', 'assets');
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.png')) hashes.set(sha256(path.join(dir, file)), file);
    }
  }
  return hashes;
}

/** Every Expo project id a tenant already owns, lower case, → "tenant/app". */
function tenantProjectIds(tenants) {
  const ids = new Map();
  for (const tenant of tenants) {
    const profile = tenantProfile(tenant);
    if (profile?.easProjectId) ids.set(String(profile.easProjectId).toLowerCase(), tenant);
    for (const [app, entry] of Object.entries(profile?.apps ?? {})) {
      if (entry?.easProjectId) ids.set(String(entry.easProjectId).toLowerCase(), `${tenant}/${app}`);
    }
  }
  return ids;
}

/** app.config.js evaluated in a child process, so its reads of process.env see only what we give it. */
function resolveConfig(app, { tenant } = {}) {
  const env = { ...process.env, EAS_BUILD: 'true', NODE_ENV: 'production' };
  for (const key of Object.keys(env)) {
    if (key === 'TENANT_ID' || key === 'KIOSK_TENANT' || key.startsWith('EXPO_PUBLIC_')) delete env[key];
  }
  if (tenant) {
    env.TENANT_ID = tenant;
    env.KIOSK_TENANT = tenant;
  }
  const appDir = path.join(mobileRoot, 'apps', app);
  const out = execFileSync(
    process.execPath,
    ['-e', 'process.stdout.write(JSON.stringify(require(process.argv[1])))', path.join(appDir, 'app.config.js')],
    { cwd: appDir, env, encoding: 'utf8' },
  );
  return JSON.parse(out).expo;
}

function sourceFiles() {
  const files = [];
  const skip = new Set(['node_modules', 'dist', 'build', '.expo', '.turbo']);
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
        files.push({
          path: path.relative(mobileRoot, full).split(path.sep).join('/'),
          text: fs.readFileSync(full, 'utf8'),
        });
      }
    }
  };
  for (const group of ['apps', 'packages']) {
    for (const entry of fs.readdirSync(path.join(mobileRoot, group), { withFileTypes: true })) {
      const src = path.join(mobileRoot, group, entry.name, 'src');
      if (entry.isDirectory() && fs.existsSync(src)) visit(src);
    }
  }
  return files;
}

/** apps/<app>/assets/<file> against the file the shared profile holds for that app. */
function assetCopyPairs() {
  const shared = path.join(tenantsDir, SHARED_TENANT_ID, 'assets');
  const pairs = [];
  for (const app of APPS) {
    for (const file of ['icon.png', 'adaptive-icon.png', 'favicon.png', 'splash.png']) {
      const perApp = path.join(shared, app, file);
      const common = path.join(shared, file);
      const source = fs.existsSync(perApp) ? perApp : common;
      const copy = path.join(mobileRoot, 'apps', app, 'assets', file);
      if (fs.existsSync(source) && fs.existsSync(copy)) {
        pairs.push({ app, file, appHash: sha256(copy), sharedHash: sha256(source) });
      }
    }
  }
  return pairs;
}

function run({ only }) {
  const apps = only ? [only] : APPS;
  const tenants = knownTenants();
  const hashes = palmartHashes();
  const projects = tenantProjectIds(tenants);
  const findings = [];

  findings.push(...checkSharedProfile(tenantProfile(SHARED_TENANT_ID)));

  for (const app of apps) {
    let expo;
    try {
      expo = resolveConfig(app);
    } catch (error) {
      findings.push({ level: 'fail', id: 'resolve', message: `${app}: app.config.js did not resolve: ${error.message.split('\n')[0]}` });
      continue;
    }
    const appDir = path.join(mobileRoot, 'apps', app);
    findings.push(
      ...checkResolvedConfig({
        app,
        expo,
        palmartHashes: hashes,
        tenantProjectIds: projects,
        hashOf: (rel) => {
          const file = path.resolve(appDir, rel);
          return fs.existsSync(file) ? sha256(file) : null;
        },
      }),
    );
  }

  findings.push(...checkAssetCopies(assetCopyPairs().filter((pair) => apps.includes(pair.app))));
  findings.push(...scanSource({ files: sourceFiles(), allowList }));

  const templateText = fs.readFileSync(path.join(mobileRoot, 'eas.json'), 'utf8');
  const copies = {};
  for (const app of APPS) {
    const file = path.join(mobileRoot, 'apps', app, 'eas.json');
    copies[app] = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  }
  findings.push(...checkEas({ templateText, copies, knownTenants: tenants }));

  // Known and deliberately deferred: plan §5.7 also asks white-label builds to drop `kiosk`. Doing it
  // changes a live tenant's resolved config, so it waits for a decision. Keep it visible.
  if (tenants.includes('palmart') && !only) {
    try {
      const schemes = [].concat(resolveConfig('cashier', { tenant: 'palmart' }).scheme ?? []);
      if (schemes.includes('kiosk')) {
        findings.push(warn('white-label-scheme', 'white-label builds still claim kiosk:// (plan §5.7). Deferred; see ADR "distribution and white-label truth".'));
      }
    } catch {
      /* a tenant that does not resolve is reported by its own checks */
    }
  }

  return findings;
}

function main() {
  const args = process.argv.slice(2);
  const appFlag = args.indexOf('--app');
  const only = appFlag >= 0 ? args[appFlag + 1] : undefined;
  if (only && !APPS.includes(only)) {
    console.error(`Unknown app "${only}". Choose one of: ${APPS.join(', ')}`);
    process.exit(2);
  }

  const findings = run({ only });
  const { failures, pending, warnings } = classify(findings, {
    allowOwnerBlocked: args.includes('--allow-owner-blocked'),
  });

  if (args.includes('--json')) {
    console.log(JSON.stringify({ ok: failures.length === 0, pending: pending.length, findings }, null, 2));
  } else {
    for (const f of failures) console.log(`FAIL ${f.id.padEnd(20)} ${f.message}${f.blockedOn ? '  [needs you]' : ''}`);
    for (const f of pending) console.log(`PEND ${f.id.padEnd(20)} ${f.message}  [needs you]`);
    for (const f of warnings) console.log(`WARN ${f.id.padEnd(20)} ${f.message}`);
    const blocked = failures.filter((f) => f.blockedOn).length;
    const tail =
      `${pending.length ? `, ${pending.length} waiting on you` : ''}` +
      `${warnings.length ? `, ${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : ''}`;
    console.log(
      failures.length === 0
        ? `\nGeneric config guard: pass${tail}.`
        : `\nGeneric config guard: ${failures.length} failure${failures.length > 1 ? 's' : ''}` +
            `${blocked ? `, ${blocked} of them need something only you can create` : ''}${tail}.`,
    );
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
