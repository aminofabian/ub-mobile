/**
 * Lets a shop's white-label build ship its own copy of a piece of in-app art.
 *
 * The app requires the neutral file ("../../assets/brand-mark.png"). The generic build bundles it as is.
 * A build for shop <id> bundles tenants/<id>/assets/brand-mark.png instead, when that file exists: the
 * same convention expo-white-label.js uses for the icon and splash. Without this the shop's app would
 * carry the platform's mark inside, whatever its icon says.
 */

/** In-app art a shop may replace. Native art (icon, splash) is handled in expo-white-label.js. */
const REPLACEABLE = new Set(['brand-mark.png']);

/**
 * @param {unknown} moduleName The specifier the app wrote, e.g. "../../assets/brand-mark.png".
 * @param {(filename: string) => string | null} resolveAsset Absolute path of the shop's copy, or null.
 * @returns {string | null}
 */
function overrideFor(moduleName, resolveAsset) {
  if (typeof moduleName !== 'string') {
    return null;
  }
  const match = /(?:^|[\\/])assets[\\/]([^\\/]+)$/.exec(moduleName);
  if (!match || !REPLACEABLE.has(match[1])) {
    return null;
  }
  return resolveAsset(match[1]);
}

/**
 * Wraps Metro's resolver. Any resolver already configured still runs, on the swapped path.
 *
 * @param {import('metro-config').ConfigT} config
 * @param {{ resolveAsset: (filename: string) => string | null }} options
 */
function withTenantAssets(config, { resolveAsset }) {
  const previous = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const target = overrideFor(moduleName, resolveAsset) ?? moduleName;
    return previous
      ? previous(context, target, platform)
      : context.resolveRequest(context, target, platform);
  };
  return config;
}

module.exports = { REPLACEABLE, overrideFor, withTenantAssets };
