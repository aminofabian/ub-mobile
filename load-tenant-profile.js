const path = require('path');
const fs = require('fs');

const TENANTS_DIR = path.join(__dirname, 'tenants');

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
  tenantIdFromEnv,
  resolveProfilePath,
  resolveTenantAsset,
  loadTenantProfile,
  relativeFromCwd,
};
