const Constants = { expoConfig: { extra: {} } };

/** Sets app.config extras for the build under test, e.g. { embeddedTenantSlug: 'acme' }. Resets the version. */
export function __setExtra(extra = {}) {
  Constants.expoConfig = { extra: { ...extra } };
}

/** Sets the build's own version, as app.config's `version` would. */
export function __setVersion(version) {
  Constants.expoConfig = { ...Constants.expoConfig, version };
}

export default Constants;
