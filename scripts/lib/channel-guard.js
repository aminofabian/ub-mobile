'use strict';
/**
 * EAS channel and profile rules (plan §5.9 "channels … and a guard that a tenant channel starts
 * with the tenant slug"). Pure functions: no file system, no EAS, so scripts/check-generic-config.js,
 * eas-tenant-build.js and eas-tenant-update.js can all share them and the tests can run anywhere.
 */

/**
 * Pseudo-tenant for the generic (marketplace) build. Real slugs are [a-z0-9-], so no shop can ever
 * be called this.
 */
const SHARED_TENANT_ID = '_shared';

/** Namespace of the tenant-neutral profiles that the white-label publish workflow builds with. */
const NEUTRAL_PREFIX = 'tenant-';

/** Slugs whose channels would collide with the two namespaces above. */
const RESERVED_TENANT_IDS = ['generic', 'tenant'];

function genericPrefix(app) {
  return `generic-${app}-`;
}

/** The root eas.json is a template: `{app}` becomes the app's name in each app's copy. */
function renderEasConfig(templateText, app) {
  return templateText.replaceAll('{app}', app);
}

/**
 * Follows `extends` and merges `channel` and `env` the way EAS does (the child wins).
 * @returns {{ channel?: string, env: Record<string, string> }}
 */
function resolveProfile(easJson, name) {
  const profiles = easJson?.build ?? {};
  const seen = [];
  const chain = [];
  let current = name;
  while (current) {
    if (seen.includes(current)) {
      throw new Error(`eas.json: profile "${name}" extends itself (${[...seen, current].join(' → ')}).`);
    }
    seen.push(current);
    const profile = profiles[current];
    if (!profile) {
      throw new Error(
        `eas.json has no build profile "${current}"${current === name ? '' : ` (extended by "${name}")`}.`,
      );
    }
    chain.push(profile);
    current = profile.extends;
  }
  return chain.reduceRight(
    (merged, profile) => ({
      ...merged,
      ...(profile.channel !== undefined ? { channel: profile.channel } : {}),
      env: { ...merged.env, ...(profile.env ?? {}) },
    }),
    { env: {} },
  );
}

function defaultProfile({ tenant }) {
  return tenant === SHARED_TENANT_ID ? 'preview' : `${tenant}-preview`;
}

function defaultChannel({ tenant, app }) {
  return tenant === SHARED_TENANT_ID ? `${genericPrefix(app)}preview` : `${tenant}-preview`;
}

/**
 * May this tenant's build or update use this channel?
 *  - `_shared` (the generic build): `generic-<app>-…` only.
 *  - a shop: `<slug>` or `<slug>-…`, or the tenant-neutral `tenant-…` namespace. Never another
 *    shop's channel and never `generic-…`.
 */
function checkChannel({ tenant, app, channel, knownTenants = [] }) {
  if (!channel) {
    return { ok: false, reason: 'the profile sets no channel' };
  }
  if (tenant === SHARED_TENANT_ID) {
    return channel.startsWith(genericPrefix(app))
      ? { ok: true }
      : { ok: false, reason: `the generic ${app} must use a channel starting "${genericPrefix(app)}" (got "${channel}")` };
  }
  if (RESERVED_TENANT_IDS.includes(tenant)) {
    return { ok: false, reason: `"${tenant}" is reserved and cannot be a shop's slug` };
  }
  if (channel === tenant || channel.startsWith(`${tenant}-`) || channel.startsWith(NEUTRAL_PREFIX)) {
    return { ok: true };
  }
  if (channel.startsWith('generic-')) {
    return { ok: false, reason: `"${channel}" is a generic-build channel and ${tenant} is a shop` };
  }
  const other = knownTenants.find((t) => t !== tenant && (channel === t || channel.startsWith(`${t}-`)));
  return {
    ok: false,
    reason: other
      ? `"${channel}" belongs to ${other}, not ${tenant}`
      : `"${channel}" does not start with "${tenant}-"`,
  };
}

/**
 * Is this EAS profile safe to use for this tenant and app?
 * @returns {{ ok: boolean, problems: string[], channel?: string }}
 */
function checkProfile({ easJson, profileName, tenant, app, knownTenants = [] }) {
  const problems = [];
  let resolved;
  try {
    resolved = resolveProfile(easJson, profileName);
  } catch (error) {
    return { ok: false, problems: [error.message] };
  }

  const bound = [...new Set([resolved.env.TENANT_ID, resolved.env.KIOSK_TENANT].filter(Boolean))];
  for (const boundTenant of bound) {
    if (boundTenant !== tenant) {
      problems.push(`profile "${profileName}" is bound to tenant "${boundTenant}", not "${tenant}"`);
    }
  }
  const channel = checkChannel({ tenant, app, channel: resolved.channel, knownTenants });
  if (!channel.ok) {
    problems.push(`profile "${profileName}": ${channel.reason}`);
  }
  return { ok: problems.length === 0, problems, channel: resolved.channel };
}

module.exports = {
  SHARED_TENANT_ID,
  NEUTRAL_PREFIX,
  RESERVED_TENANT_IDS,
  genericPrefix,
  renderEasConfig,
  resolveProfile,
  defaultProfile,
  defaultChannel,
  checkChannel,
  checkProfile,
};
