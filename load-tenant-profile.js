const path = require('path');
const fs = require('fs');

const TENANTS_DIR = path.join(__dirname, 'tenants');

/**
 * The profile that brands the generic build. Not a valid shop slug ([a-z0-9-]), so no shop can be called this.
 */
const SHARED_TENANT_ID = '_shared';

function tenantIdFromEnv() {
  return (process.env.TENANT_ID || process.env.KIOSK_TENANT || '').trim();
}

function resolveProfilePath(tenantId) {
  const nested = path.join(TENANTS_DIR, tenantId, 'config.json');
  if (fs.existsSync(nested)) {
    return nested;
  }
  const flat = path.join(TENANTS_DIR, `${tenantId}.json`);
  if (fs.existsSync(flat)) {
    return flat;
  }
  return null;
}

/**
 * Slugs of the shops that have a profile. `_shared` (the generic build) is not a shop, and neither is
 * anything else that starts with an underscore or a dot.
 */
function listTenantIds() {
  if (!fs.existsSync(TENANTS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(TENANTS_DIR, { withFileTypes: true })
    .map((entry) => (entry.isDirectory() ? entry.name : entry.name.replace(/\.json$/, '')))
    .filter((name) => name && !name.startsWith('_') && !name.startsWith('.'));
}

function resolveTenantAsset(tenantId, filename) {
  const dir = path.join(TENANTS_DIR, tenantId);
  const candidates = [path.join(dir, filename), path.join(dir, 'assets', filename)];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function loadTenantProfile(tenantId = tenantIdFromEnv()) {
  if (!tenantId) {
    return null;
  }
  const profilePath = resolveProfilePath(tenantId);
  if (!profilePath) {
    throw new Error(
      `Unknown tenant "${tenantId}". Add mobile/tenants/${tenantId}/config.json (or ${tenantId}.json).`
    );
  }
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  return {
    tenantId,
    profilePath,
    tenantDir: path.join(TENANTS_DIR, tenantId),
    profile,
  };
}

function relativeFromCwd(absPath) {
  return path.relative(process.cwd(), absPath).replace(/\\/g, '/');
}

module.exports = {
  TENANTS_DIR,
  SHARED_TENANT_ID,
  tenantIdFromEnv,
  resolveProfilePath,
  listTenantIds,
  resolveTenantAsset,
  loadTenantProfile,
  relativeFromCwd,
};
