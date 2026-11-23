/**
 * Where everything lives (plan §5.2). Pure: no imports, so the whole layout reads in one place.
 *
 * Two stores. `secure` is SecureStore, the OS keychain: tokens, the till id, the Shopper's device
 * secret. On iOS it survives an uninstall. `plain` is AsyncStorage, wiped by an uninstall: the
 * active-store pointer, snapshots, the profile, phone hints, the outbox.
 *
 * Every key that belongs to a shop carries that shop's tenant id, so two shops on one phone never
 * share a token, a till id or a queued sale.
 */

/** 1 = the original layout (one global token, one global outbox, one tenant pointer). 2 = this one. */
export const STORAGE_VERSION = 2;

/**
 * plain. Absent: a fresh install, or one not upgraded yet. "2": the v2 layout is in place.
 * "migrating:<slug>": a v1 to v2 migration has started for that shop ("migrating:" when none is
 * known). One key holds both so the last step, flipping it to "2", is a single write.
 */
export const SCHEMA_KEY = 'kiosk.storageVersion';
export const MIGRATING_PREFIX = 'migrating:';
/** plain. The tenant id of the active store. */
export const ACTIVE_TENANT_KEY = 'kiosk.v2.activeTenant';
/** plain. Tenant ids, most recent first, at most RECENT_LIMIT. */
export const RECENT_TENANTS_KEY = 'kiosk.v2.recentTenants';
/** plain. { [slug]: namespace id } for namespaces made from legacy data, until the server confirms the id. */
export const PROVISIONAL_KEY = 'kiosk.v2.provisional';
/** secure. Every secure key this layer wrote, so a fresh install can purge what an uninstall left. */
export const SECURE_INDEX_KEY = 'kiosk.v2.secureIndex';

/** plain. A legacy outbox that was not valid JSON, kept as found rather than dropped. */
export const CORRUPT_OUTBOX_KEY = 'kiosk.v2.corruptOutbox';

export const RECENT_LIMIT = 5;

/** Kept in SecureStore. */
export const SECURE_FIELDS = ['accessToken', 'refreshToken', 'tillDeviceId', 'deviceSecret'] as const;
/** Kept in AsyncStorage. */
export const PLAIN_FIELDS = [
  'profile',
  'tabPhone',
  'airtimeRecipient',
  'airtimePayer',
  /** Staff apps: the people who have signed in on this phone at this shop (first name and email), for the sign-in chips. */
  'knownStaff',
  /** Staff apps: the branch this phone was last seen registered as a till for. Lets the app say "removed", not "never registered". */
  'tillSeen',
] as const;

export type SecureField = (typeof SECURE_FIELDS)[number];
export type PlainField = (typeof PLAIN_FIELDS)[number];

/** Names a tenant id may never take, because the layout above gives them another meaning. */
const RESERVED_IDS = new Set([
  'tenant',
  'activeTenant',
  'recentTenants',
  'provisional',
  'secureIndex',
  'installId',
]);

/**
 * SecureStore keys may hold only letters, digits, ".", "-" and "_", so a tenant id must too.
 * Server ids are UUIDs; "pending-<slug>" ids made by the migration fit as well.
 */
export function assertTenantId(id: string): string {
  if (!isStorableTenantId(id)) {
    throw new Error('Invalid tenant id for storage.');
  }
  return id;
}

export function isStorableTenantId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id) && !RESERVED_IDS.has(id);
}

/** Namespaces made from v1 data carry this prefix until the server confirms the real tenant id. */
export const PROVISIONAL_PREFIX = 'pending-';

export function isProvisionalId(id: string): boolean {
  return id.startsWith(PROVISIONAL_PREFIX);
}

/**
 * Queued work from the v1 layout that could not be tied to a shop. It is kept, never sent: no sync
 * engine drains this namespace, so it cannot reach the wrong shop.
 */
export const UNOWNED_ID = 'unowned';

export function snapshotKey(tenantId: string): string {
  return `kiosk.v2.tenant.${assertTenantId(tenantId)}`;
}

export function secureKey(tenantId: string, field: SecureField): string {
  return `kiosk.v2.${assertTenantId(tenantId)}.${field}`;
}

export function plainKey(tenantId: string, field: PlainField): string {
  return `kiosk.v2.${assertTenantId(tenantId)}.${field}`;
}

/** One outbox per shop (plan §5.4). The sync engine of a shop drains only this key. */
export function outboxKey(tenantId: string): string {
  return `@kiosk/offline/outbox/${assertTenantId(tenantId)}`;
}

/** Where a queue that could not be read is kept, for support, while a fresh one takes its place. */
export function unreadableOutboxKey(tenantId: string): string {
  return `${outboxKey(tenantId)}.unreadable`;
}

/** What a shop-less install called a store that has not been confirmed by the server yet. */
export function provisionalId(slug: string): string {
  return `${PROVISIONAL_PREFIX}${slug}`;
}

/** The original layout. Read once by the migration, then deleted; nothing else may use these. */
export const LEGACY_SECURE = {
  tenant: 'kiosk.tenant',
  accessToken: 'kiosk.accessToken',
  refreshToken: 'kiosk.refreshToken',
  tillDeviceId: 'ub.tillDeviceId',
  deviceSecret: 'palmart.shopper.deviceSecret',
} as const;

export const LEGACY_PLAIN = {
  outbox: '@kiosk/offline/outbox',
  profile: 'palmart.shopper.profile',
  tabPhone: 'palmart.customer.tabPhone',
  airtimeRecipient: 'palmart.customer.lastAirtimeRecipient',
  airtimePayer: 'palmart.customer.lastAirtimePayer',
} as const;
