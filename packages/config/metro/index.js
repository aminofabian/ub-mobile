const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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
  return withMonorepoPaths(config);
};
