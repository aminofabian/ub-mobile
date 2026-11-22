'use strict';
/**
 * Checks behind scripts/check-generic-config.js (plan §5.9 "Config guard in CI").
 *
 * Everything here is a pure function over plain data, so the tests need no Expo, no git and no
 * disk. The CLI does the reading (resolving each app.config.js, hashing files, walking source)
 * and hands the results in.
 *
 * A finding is { level: 'fail' | 'warn', id, message, blockedOn?: 'owner' }. `blockedOn: 'owner'`
 * marks a failure that no code change can fix, because it needs something only the owner can
 * create (an Expo project, store art). The guard stays red on it until it exists.
 */
const { SHARED_TENANT_ID, RESERVED_TENANT_IDS, checkChannel, checkProfile, renderEasConfig, resolveProfile } = require('./channel-guard');

const APPS = ['shopper', 'cashier', 'grocery', 'admin', 'stock'];

const PALMART = /palmart/i;

/** Keys that only a white-label build may carry in `extra`. */
const WHITE_LABEL_EXTRAS = [
  'embeddedTenantSlug',
  'isWhiteLabel',
  'tenantId',
  'tenantDisplayName',
  'tenantHost',
  'primaryColor',
  'themeColors',
];

const EXPO_PROJECT_URL = /^https:\/\/u\.expo\.dev\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

function fail(id, message, extra = {}) {
  return { level: 'fail', id, message, ...extra };
}

function warn(id, message) {
  return { level: 'warn', id, message };
}

/** The platform's own bundle id for an app (backend: app.mobile.platform-bundles.*). */
function platformBundleId(app) {
  return `com.kioskke.${app}`;
}

/**
 * Plan §5.7: one scheme per app. The Shopper also keeps `kiosk` through a deprecation window,
 * because printed links and codes in the wild use it. No other app may claim it.
 */
function expectedSchemes(app) {
  return app === 'shopper' ? ['kioskshopper', 'kiosk'] : [`kiosk${app}`];
}

function asList(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

/** Every string (and key) in a value, with its path. */
function* walk(value, at = '') {
  if (typeof value === 'string') {
    yield { at, text: value };
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) yield* walk(value[i], `${at}[${i}]`);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      yield { at: next, text: key, isKey: true };
      yield* walk(child, next);
    }
  }
}

/**
 * The resolved Expo config of a generic app, built with EAS_BUILD=true, NODE_ENV=production and no
 * TENANT_ID.
 *
 * @param {object} input
 * @param {string} input.app
 * @param {object} input.expo   `require('apps/<app>/app.config.js').expo`
 * @param {(relPath: string) => string | null} input.hashOf  sha256 of a path in the config, or null if missing
 * @param {Map<string, string>} input.palmartHashes          sha256 → Palmart asset name
 * @param {Map<string, string>} input.tenantProjectIds       lower-case Expo project id → "tenant/app"
 */
function checkResolvedConfig({ app, expo, hashOf, palmartHashes, tenantProjectIds }) {
  const findings = [];

  for (const { at, text } of walk(expo)) {
    if (PALMART.test(text)) {
      findings.push(fail('palmart-in-config', `${app}: "${text}" at ${at}`));
    }
  }

  const extra = expo.extra ?? {};
  const carried = WHITE_LABEL_EXTRAS.filter((key) => key in extra);
  if (carried.length > 0) {
    findings.push(fail('white-label-flags', `${app}: a generic build must not set extra.${carried.join(', extra.')}`));
  }

  const schemes = asList(expo.scheme);
  const want = expectedSchemes(app);
  if (schemes.length !== want.length || !want.every((s) => schemes.includes(s))) {
    findings.push(fail('scheme', `${app}: scheme is [${schemes.join(', ')}], expected [${want.join(', ')}]`));
  }

  const bundle = platformBundleId(app);
  if (expo.ios?.bundleIdentifier !== bundle || expo.android?.package !== bundle) {
    findings.push(
      fail(
        'bundle-ids',
        `${app}: ios ${expo.ios?.bundleIdentifier ?? '—'}, android ${expo.android?.package ?? '—'}; the platform id is ${bundle}`,
      ),
    );
  }

  if (expo.runtimeVersion?.policy !== 'appVersion') {
    findings.push(fail('runtime-version', `${app}: runtimeVersion is not { policy: 'appVersion' } (plan §5.9 keeps appVersion)`));
  }

  const projectId = expo.extra?.eas?.projectId;
  const url = expo.updates?.url;
  if (!projectId) {
    findings.push(
      fail(
        'expo-project',
        `${app}: no Expo project, so no updates.url. Create it with "pnpm eas:init ${SHARED_TENANT_ID} ${app}"; that writes apps.${app}.easProjectId into tenants/${SHARED_TENANT_ID}/config.json.`,
        { blockedOn: 'owner' },
      ),
    );
  } else {
    const shared = tenantProjectIds.get(String(projectId).toLowerCase());
    if (shared) {
      findings.push(fail('expo-project-shared', `${app}: Expo project ${projectId} already belongs to ${shared}`));
    }
    const match = typeof url === 'string' ? EXPO_PROJECT_URL.exec(url) : null;
    if (!match) {
      findings.push(fail('updates-url', `${app}: updates.url is ${url ?? 'missing'}, expected https://u.expo.dev/${projectId}`));
    } else if (match[1].toLowerCase() !== String(projectId).toLowerCase()) {
      findings.push(fail('updates-url', `${app}: updates.url points at ${match[1]} but extra.eas.projectId is ${projectId}`));
    }
  }

  const assets = [
    ['icon', expo.icon],
    ['splash.image', expo.splash?.image],
    ['android.adaptiveIcon.foregroundImage', expo.android?.adaptiveIcon?.foregroundImage],
    ['web.favicon', expo.web?.favicon],
  ];
  for (const [key, relPath] of assets) {
    if (typeof relPath !== 'string') {
      findings.push(fail('assets', `${app}: ${key} is not set`));
      continue;
    }
    const hash = hashOf(relPath);
    if (!hash) {
      findings.push(fail('assets', `${app}: ${key} → ${relPath} does not exist`));
    } else if (palmartHashes.has(hash)) {
      findings.push(fail('assets', `${app}: ${key} → ${relPath} is Palmart's ${palmartHashes.get(hash)} byte for byte`));
    }
  }

  return findings;
}

/** `tenants/_shared/config.json`: the profile that brands the marketplace listing. */
function checkSharedProfile(profile) {
  const findings = [];
  if (!profile) {
    return [fail('shared-profile', `tenants/${SHARED_TENANT_ID}/config.json is missing`)];
  }
  if (profile.marketplace !== true) {
    findings.push(fail('shared-profile', 'marketplace must be true, or the build would embed a tenant'));
  }
  for (const key of ['embeddedTenantSlug', 'tenantId', 'isWhiteLabel']) {
    if (key in profile) findings.push(fail('shared-profile', `${key} must not be set on the shared profile`));
  }
  for (const { at, text } of walk(profile)) {
    if (PALMART.test(text)) findings.push(fail('shared-profile', `"${text}" at ${at}`));
  }
  for (const app of APPS) {
    const entry = profile.apps?.[app];
    if (!entry) {
      findings.push(fail('shared-profile', `no apps.${app} entry`));
    } else if (entry.iosBundleId !== platformBundleId(app) || entry.androidPackage !== platformBundleId(app)) {
      findings.push(fail('shared-profile', `apps.${app} must use ${platformBundleId(app)} for ios and android`));
    }
  }
  return findings;
}

/**
 * Case-insensitive "palmart" in source, minus the allow-list.
 * @param {{ path: string, text: string }[]} files  posix paths relative to mobile/
 * @param {{ file: string, match: RegExp, reason: string }[]} allowList
 */
function scanSource({ files, allowList }) {
  const findings = [];
  const used = new Set();
  for (const { path: file, text } of files) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (!PALMART.test(lines[i])) continue;
      const index = allowList.findIndex((entry) => entry.file === file && entry.match.test(lines[i]));
      if (index >= 0) {
        used.add(index);
      } else {
        findings.push(fail('palmart-in-source', `${file}:${i + 1}  ${lines[i].trim().slice(0, 100)}`));
      }
    }
  }
  allowList.forEach((entry, index) => {
    if (!used.has(index)) {
      findings.push(fail('allow-list', `${entry.file} ${entry.match} matches nothing. Delete the entry.`));
    }
  });
  return findings;
}

/**
 * eas.json: the root file is a template, each app has a rendered copy, and every profile's channel
 * must belong to the tenant (or the generic build) it builds.
 *
 * @param {object} input
 * @param {string} input.templateText      mobile/eas.json
 * @param {Record<string, string | null>} input.copies  apps/<app>/eas.json text per app (null if missing)
 * @param {string[]} input.knownTenants    ids of the tenants that have a profile (not `_shared`)
 */
function checkEas({ templateText, copies, knownTenants }) {
  const findings = [];
  for (const app of APPS) {
    const copy = copies[app];
    if (copy === null || copy === undefined) {
      findings.push(fail('eas-copy', `apps/${app}/eas.json is missing. Run "pnpm eas:sync".`));
      continue;
    }
    if (copy !== renderEasConfig(templateText, app)) {
      findings.push(fail('eas-copy', `apps/${app}/eas.json differs from eas.json. Run "pnpm eas:sync".`));
    }
    let json;
    try {
      json = JSON.parse(copy);
    } catch (error) {
      findings.push(fail('eas-copy', `apps/${app}/eas.json is not valid JSON: ${error.message}`));
      continue;
    }
    for (const name of Object.keys(json.build ?? {})) {
      const resolved = resolveProfile(json, name);
      const bound = resolved.env.TENANT_ID || resolved.env.KIOSK_TENANT;
      if (bound) {
        if (resolved.env.TENANT_ID && resolved.env.KIOSK_TENANT && resolved.env.TENANT_ID !== resolved.env.KIOSK_TENANT) {
          findings.push(fail('eas-channel', `${app}: profile "${name}" sets TENANT_ID and KIOSK_TENANT to different shops`));
        }
        if (!knownTenants.includes(bound)) {
          findings.push(fail('eas-channel', `${app}: profile "${name}" is bound to "${bound}", which has no tenants/${bound}/config.json`));
        }
        const result = checkProfile({ easJson: json, profileName: name, tenant: bound, app, knownTenants });
        for (const problem of result.problems) findings.push(fail('eas-channel', `${app}: ${problem}`));
      } else if (resolved.channel !== undefined) {
        if (name.startsWith('tenant-')) {
          if (!resolved.channel.startsWith('tenant-')) {
            findings.push(fail('eas-channel', `${app}: tenant-neutral profile "${name}" must use a "tenant-…" channel (got "${resolved.channel}")`));
          }
        } else {
          const result = checkChannel({ tenant: SHARED_TENANT_ID, app, channel: resolved.channel });
          if (!result.ok) findings.push(fail('eas-channel', `${app}: profile "${name}": ${result.reason}`));
        }
      }
    }
  }
  for (const reserved of RESERVED_TENANT_IDS) {
    if (knownTenants.includes(reserved)) {
      findings.push(fail('eas-channel', `tenants/${reserved} is reserved: its channels would collide with the generic and tenant-neutral ones`));
    }
  }
  return findings;
}

/** apps/<app>/assets must hold the same bytes the shared profile resolves to. */
function checkAssetCopies(pairs) {
  return pairs
    .filter(({ appHash, sharedHash }) => appHash !== sharedHash)
    .map(({ app, file }) => fail('asset-copy', `apps/${app}/assets/${file} differs from tenants/${SHARED_TENANT_ID}/assets. Run "pnpm assets:default".`));
}

/**
 * Splits findings into what fails the run, what is only waiting on the owner, and what warns.
 *
 * A finding with `blockedOn` is something no code change can fix (the generic apps' Expo projects have
 * to be created with the owner's Expo login). With `allowOwnerBlocked` those are reported as pending
 * and do not fail the run, so CI can gate everything else today and be made strict later.
 */
function classify(findings, { allowOwnerBlocked = false } = {}) {
  const failures = [];
  const pending = [];
  const warnings = [];
  for (const finding of findings) {
    if (finding.level === 'warn') {
      warnings.push(finding);
    } else if (finding.level === 'fail' && finding.blockedOn && allowOwnerBlocked) {
      pending.push(finding);
    } else if (finding.level === 'fail') {
      failures.push(finding);
    }
  }
  return { failures, pending, warnings };
}

module.exports = {
  APPS,
  classify,
  PALMART,
  SOURCE_EXTENSIONS,
  expectedSchemes,
  platformBundleId,
  warn,
  fail,
  checkResolvedConfig,
  checkSharedProfile,
  scanSource,
  checkEas,
  checkAssetCopies,
};
