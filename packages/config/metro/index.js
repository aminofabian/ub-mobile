const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { tenantIdFromEnv, resolveTenantAsset } = require('../../../load-tenant-profile');
const { withTenantAssets } = require('./tenant-assets');

function withMonorepoPaths(config) {
  const projectRoot = config.projectRoot;
  const workspaceRoot = path.resolve(projectRoot, '../..');

  config.watchFolders = [workspaceRoot];

  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];

  // Force Metro to resolve symlinks
  config.resolver.disableHierarchicalLookup = false;

  return config;
}

module.exports = function getConfig(__dirname) {
  const config = getDefaultConfig(__dirname);
  const tenantId = tenantIdFromEnv();
  return withTenantAssets(withMonorepoPaths(config), {
    // A shop's build bundles that shop's own in-app art (tenants/<id>/assets); the generic build has none.
    resolveAsset: (filename) => (tenantId ? resolveTenantAsset(tenantId, filename) : null),
  });
};
