import { getEmbeddedTenantSlug, isWhiteLabelApp } from './embedded-config';
import {
  CORRUPT_OUTBOX_KEY,
  LEGACY_PLAIN,
  LEGACY_SECURE,
  MIGRATING_PREFIX,
  PLAIN_FIELDS,
  SCHEMA_KEY,
  SECURE_FIELDS,
  STORAGE_VERSION,
  UNOWNED_ID,
  isStorableTenantId,
  outboxKey,
  plainKey,
  provisionalId,
  secureKey,
  unreadableOutboxKey,
} from './storage-keys';
import {
  onRuntimeReset,
  plain,
  purgeSecureIndex,
  readJson,
  secure,
  secureGet,
  securePut,
  secureRemove,
  writeJson,
  type KeyValueStore,
} from './storage';
import {
  readPointer,
  readProvisional,
  readRecents,
  removeSnapshot,
  rememberTenant,
  writePointer,
  writeProvisional,
  writeRecents,
  writeSnapshot,
} from './tenant-store';

/**
 * Getting the device into the v2 layout (plan §5.2), once per process, before anything reads a key.
 *
 * Three starting points. A fresh install has no v1 keys: whatever the keychain kept from an earlier
 * install (iOS does that) is deleted. A v1 install is moved into the v2 layout under the shop it
 * belonged to. Anything else (v1 secrets with no v1 app data, in a build that serves any shop) is
 * treated as leftovers and deleted.
 *
 * The migration copies, checks the copy, then deletes the original, and writes the version marker
 * last. A crash anywhere leaves the originals in place and the marker absent, so the next launch
 * runs it again. Running it twice changes nothing.
 */

type OutboxRecord = Record<string, unknown>;

interface LegacyTenant {
  slug?: unknown;
  host?: unknown;
  displayName?: unknown;
  branding?: unknown;
}

interface LegacyData {
  tenant: LegacyTenant | null;
  secure: Record<(typeof SECURE_FIELDS)[number], string | null>;
  plain: Record<(typeof PLAIN_FIELDS)[number], string | null>;
  outboxRaw: string | null;
  anySecure: boolean;
  anyPlain: boolean;
}

interface MigrationRecord {
  ownerSlug: string | null;
}

let readyPromise: Promise<void> | null = null;
onRuntimeReset(() => {
  readyPromise = null;
});

export function ensureStorageReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = runSetup().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

async function runSetup(): Promise<void> {
  const store = await plain();
  const marker = await store.get(SCHEMA_KEY);

  // A migration that was started and not finished remembers whose data it is moving.
  const record: MigrationRecord | null = marker?.startsWith(MIGRATING_PREFIX)
    ? { ownerSlug: marker.slice(MIGRATING_PREFIX.length) || null }
    : null;
  if (!record && Number(marker) >= STORAGE_VERSION) {
    // Already v2, or written by a newer build after a downgrade: not ours to touch.
    return;
  }

  const legacy = await readLegacy(store);
  if (record || legacy.anyPlain || (isWhiteLabelApp() && legacy.anySecure)) {
    await migrateV1(store, legacy, record);
  } else {
    await clearLeftovers();
    await store.set(SCHEMA_KEY, String(STORAGE_VERSION));
  }
}

async function readLegacy(store: KeyValueStore): Promise<LegacyData> {
  const tenantRaw = await secureGet(LEGACY_SECURE.tenant);
  let tenant: LegacyTenant | null = null;
  if (tenantRaw) {
    try {
      const parsed: unknown = JSON.parse(tenantRaw);
      tenant = parsed && typeof parsed === 'object' ? (parsed as LegacyTenant) : null;
    } catch {
      tenant = null;
    }
  }

  const secureValues = {
    accessToken: await secureGet(LEGACY_SECURE.accessToken),
    refreshToken: await secureGet(LEGACY_SECURE.refreshToken),
    tillDeviceId: await secureGet(LEGACY_SECURE.tillDeviceId),
    deviceSecret: await secureGet(LEGACY_SECURE.deviceSecret),
  };
  const plainValues = {
    profile: await store.get(LEGACY_PLAIN.profile),
    tabPhone: await store.get(LEGACY_PLAIN.tabPhone),
    airtimeRecipient: await store.get(LEGACY_PLAIN.airtimeRecipient),
    airtimePayer: await store.get(LEGACY_PLAIN.airtimePayer),
  };
  const outboxRaw = await store.get(LEGACY_PLAIN.outbox);

  return {
    tenant,
    secure: secureValues,
    plain: plainValues,
    outboxRaw,
    anySecure: tenantRaw !== null || Object.values(secureValues).some((value) => value !== null),
    anyPlain: outboxRaw !== null || Object.values(plainValues).some((value) => value !== null),
  };
}

/** Whose v1 data this is: the shop the build is made for, else the shop the old pointer named. */
function decideOwner(legacy: LegacyData): string | null {
  const embedded = getEmbeddedTenantSlug()?.toLowerCase() ?? null;
  const pointed = typeof legacy.tenant?.slug === 'string' ? legacy.tenant.slug.trim().toLowerCase() : null;
  const owner = embedded ? (pointed && pointed !== embedded ? null : embedded) : pointed;
  return owner && isStorableTenantId(provisionalId(owner)) ? owner : null;
}

function parseOutbox(raw: string | null): OutboxRecord[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is OutboxRecord => Boolean(item) && typeof item === 'object')
      : [];
  } catch {
    return [];
  }
}

function itemId(item: OutboxRecord): string | null {
  return typeof item.id === 'string' ? item.id : null;
}

/** Adds items to a shop's queue, skipping any whose id is already there (the queue's own copy wins). */
async function mergeOutbox(store: KeyValueStore, tenantId: string, incoming: OutboxRecord[]): Promise<void> {
  const key = outboxKey(tenantId);
  const merged = parseOutbox(await store.get(key));
  const seen = new Set(merged.map(itemId).filter((id): id is string => id !== null));
  for (const item of incoming) {
    const id = itemId(item);
    if (id !== null && seen.has(id)) {
      continue;
    }
    if (id !== null) {
      seen.add(id);
    }
    merged.push(item);
  }
  await store.set(key, JSON.stringify(merged));
}

async function assertQueued(store: KeyValueStore, tenantId: string, expected: OutboxRecord[]): Promise<void> {
  const present = new Set(parseOutbox(await store.get(outboxKey(tenantId))).map(itemId));
  for (const item of expected) {
    const id = itemId(item);
    if (id !== null && !present.has(id)) {
      throw new Error('Storage migration could not be verified; the original data was kept.');
    }
  }
}

async function migrateV1(store: KeyValueStore, legacy: LegacyData, record: MigrationRecord | null): Promise<void> {
  // The owner is decided once and written down, so a run that crashes halfway resumes with the same answer
  // even after the old pointer has been deleted.
  const ownerSlug = record ? record.ownerSlug : decideOwner(legacy);
  if (!record) {
    await store.set(SCHEMA_KEY, `${MIGRATING_PREFIX}${ownerSlug ?? ''}`);
  }
  const id = ownerSlug ? provisionalId(ownerSlug) : null;

  // The queue first. It is the one part of v1 data that holds work the person has not sent yet.
  let queued: OutboxRecord[] = [];
  if (legacy.outboxRaw !== null) {
    queued = parseOutbox(legacy.outboxRaw);
    if (queued.length === 0 && legacy.outboxRaw.trim() && legacy.outboxRaw.trim() !== '[]') {
      await store.set(CORRUPT_OUTBOX_KEY, legacy.outboxRaw);
    }
  }
  const bucket = id ?? UNOWNED_ID;
  if (queued.length > 0) {
    await mergeOutbox(store, bucket, queued.map((item) => ({ ...item, tenantId: bucket })));
    await assertQueued(store, bucket, queued);
  }

  if (id && ownerSlug) {
    const provisional = await readProvisional(store);
    await writeProvisional(store, { ...provisional, [ownerSlug]: id });

    if (legacy.tenant) {
      await writeSnapshot(store, {
        businessId: id,
        slug: ownerSlug,
        host: typeof legacy.tenant.host === 'string' ? legacy.tenant.host : '',
        displayName: typeof legacy.tenant.displayName === 'string' ? legacy.tenant.displayName : ownerSlug,
        branding:
          legacy.tenant.branding && typeof legacy.tenant.branding === 'object'
            ? (legacy.tenant.branding as Record<string, unknown>)
            : {},
        // The v1 record has no fetch time. The epoch reads as "unknown, treat as stale".
        fetchedAt: new Date(0).toISOString(),
      });
      await writePointer(store, id);
      await rememberTenant(store, id);
    }

    for (const field of SECURE_FIELDS) {
      const value = legacy.secure[field];
      if (value !== null) {
        await securePut(secureKey(id, field), value);
        if ((await secureGet(secureKey(id, field))) !== value) {
          throw new Error('Storage migration could not be verified; the original data was kept.');
        }
      }
    }
    for (const field of PLAIN_FIELDS) {
      const value = legacy.plain[field];
      if (value !== null) {
        await store.set(plainKey(id, field), value);
      }
    }
  }

  // Every copy is in place and checked. Delete the originals, the old pointer last.
  await secure().remove(LEGACY_SECURE.accessToken);
  await secure().remove(LEGACY_SECURE.refreshToken);
  await secure().remove(LEGACY_SECURE.tillDeviceId);
  await secure().remove(LEGACY_SECURE.deviceSecret);
  for (const key of Object.values(LEGACY_PLAIN)) {
    await store.remove(key);
  }
  await secure().remove(LEGACY_SECURE.tenant);
  // One write turns "migrating:<owner>" into "2". Until it lands, a crash resumes this migration with
  // the same owner; after it, there is nothing left to resume. There is no moment that looks like a
  // fresh install, which would delete the data that was just moved.
  await store.set(SCHEMA_KEY, String(STORAGE_VERSION));
}

/** A fresh install, or v1 leftovers in a build that serves any shop: delete what is not ours to use. */
async function clearLeftovers(): Promise<void> {
  const { failed } = await purgeSecureIndex();
  for (const key of Object.values(LEGACY_SECURE)) {
    await secure().remove(key);
  }
  if (failed > 0) {
    throw new Error('Could not clear data left by a previous install.');
  }
}

/**
 * Moves everything one namespace holds into another and removes the first. Where the target
 * already has a value, the target's value stays.
 */
async function moveNamespace(store: KeyValueStore, from: string, to: string): Promise<void> {
  for (const field of SECURE_FIELDS) {
    const value = await secureGet(secureKey(from, field));
    if (value !== null && (await secureGet(secureKey(to, field))) === null) {
      await securePut(secureKey(to, field), value);
    }
  }
  for (const field of PLAIN_FIELDS) {
    const value = await store.get(plainKey(from, field));
    if (value !== null && (await store.get(plainKey(to, field))) === null) {
      await store.set(plainKey(to, field), value);
    }
  }
  const moved = parseOutbox(await store.get(outboxKey(from)));
  if (moved.length > 0) {
    await mergeOutbox(store, to, moved.map((item) => ({ ...item, tenantId: to })));
    await assertQueued(store, to, moved);
  }

  for (const field of SECURE_FIELDS) {
    await secureRemove(secureKey(from, field));
  }
  for (const field of PLAIN_FIELDS) {
    await store.remove(plainKey(from, field));
  }
  await store.remove(outboxKey(from));
}

/**
 * If the shop was carried over from v1 under a provisional id and the server has now confirmed its
 * real id, moves everything to the real id. Returns whether anything moved.
 *
 * Call it with the outbox lock held (see outbox-lock.ts), through to the moment the new shop is
 * active: it moves the queue, and a sale queued meanwhile would be lost.
 */
export async function adoptProvisional(slug: string, verifiedId: string): Promise<boolean> {
  const store = await plain();
  const map = await readProvisional(store);
  const from = map[slug];
  if (!from) {
    return false;
  }
  if (from !== verifiedId) {
    await moveNamespace(store, from, verifiedId);
    if ((await readPointer(store)) === from) {
      await writePointer(store, verifiedId);
    }
    const recents = await readRecents(store);
    await writeRecents(store, [...new Set(recents.map((id) => (id === from ? verifiedId : id)))]);
    await removeSnapshot(store, from);
  }
  const { [slug]: _adopted, ...rest } = map;
  await writeProvisional(store, rest);
  return from !== verifiedId;
}

/**
 * Deletes one shop's data from this device. Its queued work stays unless asked for. Call it with the
 * outbox lock held, like `adoptProvisional`.
 */
export async function removeNamespace(tenantId: string, options: { dropOutbox?: boolean } = {}): Promise<void> {
  const store = await plain();
  for (const field of SECURE_FIELDS) {
    await secureRemove(secureKey(tenantId, field));
  }
  for (const field of PLAIN_FIELDS) {
    await store.remove(plainKey(tenantId, field));
  }
  await removeSnapshot(store, tenantId);
  if (options.dropOutbox) {
    await store.remove(outboxKey(tenantId));
    await store.remove(unreadableOutboxKey(tenantId));
  }
  const recents = await readRecents(store);
  await writeRecents(store, recents.filter((id) => id !== tenantId));
  const provisional = await readProvisional(store);
  const kept = Object.fromEntries(Object.entries(provisional).filter(([, id]) => id !== tenantId));
  if (Object.keys(kept).length !== Object.keys(provisional).length) {
    await writeProvisional(store, kept);
  }
}
