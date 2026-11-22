const Constants = { expoConfig: { extra: {} } };

/** Sets app.config extras for the build under test, e.g. { embeddedTenantSlug: 'acme' }. */
export function __setExtra(extra = {}) {
  Constants.expoConfig = { extra: { ...extra } };
}

export default Constants;
