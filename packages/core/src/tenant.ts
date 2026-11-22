import { withOutboxLock } from './outbox-lock';
import { onRuntimeReset, plain, secureRemove } from './storage';
import { adoptProvisional, ensureStorageReady, removeNamespace } from './storage-schema';
import { assertTenantId, isProvisionalId, isStorableTenantId, secureKey } from './storage-keys';
import { readPointer, readRecents, readSnapshot, rememberTenant, writePointer, writeSnapshot } from './tenant-store';
import { describeStoreResult, previewStore } from './tenant-resolve';
import type { StoreAudience, StoreResult, StoreSnapshot, TenantContext, UnsentSummary } from './tenant-types';

export type {
  StoreAudience,
  StoreResult,
  StoreSnapshot,
  TenantContext,
  UnavailableReason,
  UnsentSummary,
} from './tenant-types';
export { classifyStore, describeStoreResult, parseStoreInput, previewStore } from './tenant-resolve';
export type { PreviewOptions, StoreQuery } from './tenant-resolve';

/**
 * Which shop this phone is working in (plan §5.2).
 *
 * One shop is active at a time. Everything that belongs to a shop (tokens, till id, profile, queued
 * sales) is stored under that shop's id, so switching shops never mixes them. The record of the
 * active shop is kept on the device, which is why the app opens offline.
 *
 * Nothing here guesses. A shop is found by the address or name the person typed, the server answers,
 * and the answer is a StoreResult. Only a "found" result can become the active shop.
 */

export type SwitchResult =
  | { kind: 'switched'; store: StoreSnapshot | null }
  | { kind: 'blocked'; reason: 'unsent_sales'; unsent: UnsentSummary };

export type OpenStoreResult =
  | { kind: 'opened'; store: StoreSnapshot }
  | { kind: 'blocked'; reason: 'unsent_sales'; unsent: UnsentSummary }
  | Exclude<StoreResult, { kind: 'found' }>;

export type UnsentProbe = (tenantId: string) => Promise<UnsentSummary>;

export class StoreLookupError extends Error {
  readonly result: Exclude<StoreResult, { kind: 'found' }>;

  constructor(result: Exclude<StoreResult, { kind: 'found' }>, message: string) {
    super(message);
    this.name = 'StoreLookupError';
    this.result = result;
  }
}

export class StoreSwitchBlockedError extends Error {
  readonly unsent: UnsentSummary;

  constructor(unsent: UnsentSummary) {
    super(
      unsent.total === 1
        ? 'This phone still has 1 unsent sale for the current shop. Send it before switching shops.'
        : `This phone still has ${unsent.total} unsent sales for the current shop. Send them before switching shops.`,
    );
    this.name = 'StoreSwitchBlockedError';
    this.unsent = unsent;
  }
}

const NOTHING_UNSENT: UnsentSummary = { total: 0, needsAttention: 0 };

let cache: { loaded: boolean; store: StoreSnapshot | null } = { loaded: false, store: null };
let mutations: Promise<unknown> = Promise.resolve();
let unsentProbe: UnsentProbe | null = null;
const listeners = new Set<(store: StoreSnapshot | null) => void>();

onRuntimeReset(() => {
  cache = { loaded: false, store: null };
  mutations = Promise.resolve();
});

/** One change to the device's shop records at a time. */
function mutate<T>(work: () => Promise<T>): Promise<T> {
  const run = mutations.then(work, work);
  mutations = run.catch(() => undefined);
  return run;
}

/**
 * Same shop, same look, same standing. When the server last confirmed it (`fetchedAt`) is not a
 * change anyone should redraw for: apps clear their caches when this fires, so asking the server
 * again about the shop that is already open must stay quiet.
 */
function sameStore(a: StoreSnapshot | null, b: StoreSnapshot | null): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.businessId === b.businessId &&
    a.slug === b.slug &&
    a.host === b.host &&
    a.displayName === b.displayName &&
    a.status === b.status &&
    a.storefrontEnabled === b.storefrontEnabled &&
    JSON.stringify(a.branding ?? null) === JSON.stringify(b.branding ?? null)
  );
}

function setActive(next: StoreSnapshot | null): void {
  const changed = !sameStore(cache.store, next);
  cache = { loaded: true, store: next };
  if (changed) {
    for (const listener of [...listeners]) {
      try {
        listener(next);
      } catch {
        // A listener that throws must not stop the others, or the change that triggered it.
      }
    }
  }
}

/** @kiosk/offline registers how to count a shop's unsent work. Without it nothing is ever "unsent". */
export function registerUnsentProbe(probe: UnsentProbe | null): void {
  unsentProbe = probe;
}

export async function getUnsentSummary(tenantId?: string): Promise<UnsentSummary> {
  const id = tenantId ?? (await getActiveTenantId());
  if (!id || !unsentProbe) {
    return NOTHING_UNSENT;
  }
  try {
    return await unsentProbe(id);
  } catch {
    // An unreadable queue must not trap the person in a shop.
    return NOTHING_UNSENT;
  }
}

/** Calls the listener whenever the active shop, or what is known about it, changes. Returns the unsubscribe. */
export function subscribeActiveStore(listener: (store: StoreSnapshot | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Calls the listener with the id of the active shop each time it becomes a different shop, or none.
 * It stays quiet for changes to the same shop: a new name or colour, or a shop carried over from the
 * old layout getting the id the server confirmed. For anything held in memory for one shop, such as a
 * query cache, which must be dropped when the shop changes.
 */
export function subscribeActiveStoreId(listener: (tenantId: string | null) => void): () => void {
  let last: { id: string | null; slug: string | null } | undefined = cache.loaded
    ? { id: cache.store?.businessId ?? null, slug: cache.store?.slug ?? null }
    : undefined;
  return subscribeActiveStore((store) => {
    const next = { id: store?.businessId ?? null, slug: store?.slug ?? null };
    const previous = last;
    last = next;
    if (previous && previous.id === next.id) {
      return;
    }
    if (previous?.id && next.id && isProvisionalId(previous.id) && previous.slug === next.slug) {
      return;
    }
    listener(next.id);
  });
}

/** The active shop, from this device. Never touches the network, so it works in airplane mode. */
export async function loadActiveStore(): Promise<StoreSnapshot | null> {
  if (cache.loaded) {
    return cache.store;
  }
  await ensureStorageReady();
  const store = await plain();
  const id = await readPointer(store);
  const snapshot = id ? await readSnapshot(store, id) : null;
  if (!cache.loaded) {
    cache = { loaded: true, store: snapshot };
  }
  return cache.store;
}

/** A remembered shop by id: the active one from memory, any other from the device. Null when this phone has no record of it. */
export async function loadStoreById(tenantId: string): Promise<StoreSnapshot | null> {
  if (!isStorableTenantId(tenantId)) {
    return null;
  }
  const active = await loadActiveStore();
  if (active?.businessId === tenantId) {
    return active;
  }
  await ensureStorageReady();
  return readSnapshot(await plain(), tenantId);
}

export async function getActiveTenantId(): Promise<string | null> {
  return (await loadActiveStore())?.businessId ?? null;
}

async function activateInternal(store: StoreSnapshot): Promise<void> {
  assertTenantId(store.businessId);
  const plainStore = await plain();
  await writeSnapshot(plainStore, store);
  // The queue is held still from here until the new shop is active. A shop carried over from the old
  // layout has been living under a provisional id; now that the server has named it, its queue moves
  // to the real one, and no sale may be queued into the old name while that happens.
  await withOutboxLock(async () => {
    await adoptProvisional(store.slug, store.businessId);
    await writePointer(plainStore, store.businessId);
    await rememberTenant(plainStore, store.businessId);
    setActive(store);
  });
}

/** Makes a shop that `previewStore` found the active one. It is not checked against unsent work: use `switchStore` for that. */
export function activateStore(store: StoreSnapshot): Promise<void> {
  return mutate(async () => {
    await ensureStorageReady();
    await activateInternal(store);
  });
}

/**
 * Moves to another shop, or to none (null, which shows the picker).
 *
 * If the shop being left has sales that were never sent, nothing changes and the result is
 * `blocked`, so the screen can ask. With `keepUnsent` the switch goes ahead and the sales wait in
 * that shop's own queue; they are sent when the shop is opened again. When nothing is unsent, the
 * session being left is ended on this phone.
 */
export function switchStore(to: StoreSnapshot | null, options: { keepUnsent?: boolean } = {}): Promise<SwitchResult> {
  return mutate(async () => {
    await ensureStorageReady();
    const current = await loadActiveStore();
    const leaving = current && (!to || to.businessId !== current.businessId) ? current : null;

    if (leaving) {
      const unsent = await getUnsentSummary(leaving.businessId);
      if (unsent.total > 0 && !options.keepUnsent) {
        return { kind: 'blocked', reason: 'unsent_sales', unsent } as const;
      }
      if (unsent.total === 0) {
        await secureRemove(secureKey(leaving.businessId, 'accessToken'));
        await secureRemove(secureKey(leaving.businessId, 'refreshToken'));
      }
    }

    if (to) {
      await activateInternal(to);
    } else {
      await writePointer(await plain(), null);
      setActive(null);
    }
    return { kind: 'switched', store: to } as const;
  });
}

/** Look a shop up and, if it can be opened, switch to it. The call a "find my shop" screen makes. */
export async function openStore(
  input: string,
  baseURL: string,
  options: { audience: StoreAudience; keepUnsent?: boolean },
): Promise<OpenStoreResult> {
  const result = await previewStore(input, baseURL, { audience: options.audience });
  if (result.kind !== 'found') {
    return result;
  }
  const switched = await switchStore(result.store, { keepUnsent: options.keepUnsent });
  return switched.kind === 'blocked' ? switched : { kind: 'opened', store: result.store };
}

/**
 * Asks the server about the active shop again and keeps what it says (name, branding, status).
 * Meant to run in the background after the app is already open; it never throws and a failed
 * attempt changes nothing. The result says what the server answered, so a screen can react to a
 * shop that has since been suspended.
 */
export async function revalidateActive(baseURL: string, options: { audience: StoreAudience }): Promise<StoreResult | null> {
  const current = await loadActiveStore();
  if (!current) {
    return null;
  }
  const result = await previewStore(current.slug, baseURL, { audience: options.audience });
  if (result.kind !== 'found' && result.kind !== 'unavailable') {
    return result;
  }
  const fresh = result.store;
  if (!fresh) {
    return result;
  }
  if (fresh.businessId !== current.businessId && !isProvisionalId(current.businessId)) {
    // The address now belongs to a different business than the one saved here.
    return { kind: 'not_found' };
  }

  // The host the shop was opened with stays: it is the one known to work from this phone.
  const merged: StoreSnapshot = { ...fresh, host: current.host || fresh.host };
  try {
    await mutate(async () => {
      const now = await loadActiveStore();
      if (now && now.businessId === current.businessId) {
        await activateInternal(merged);
      }
    });
  } catch {
    // Storage trouble here must not turn a background refresh into an error.
  }
  return result.kind === 'found' ? { kind: 'found', store: merged } : { kind: 'unavailable', reason: result.reason, store: merged };
}

/** The shops this phone has worked in, most recent first, for a switcher. */
export async function listRememberedStores(): Promise<StoreSnapshot[]> {
  await ensureStorageReady();
  const store = await plain();
  const snapshots = await Promise.all((await readRecents(store)).map((id) => readSnapshot(store, id)));
  return snapshots.filter((snapshot): snapshot is StoreSnapshot => snapshot !== null);
}

/** Removes a shop from this phone: its session, till id, profile and hints. Unsent sales stay unless `dropOutbox`. */
export function forgetStore(tenantId: string, options: { dropOutbox?: boolean } = {}): Promise<void> {
  return mutate(async () => {
    await ensureStorageReady();
    assertTenantId(tenantId);
    await withOutboxLock(async () => {
      const active = await loadActiveStore();
      await removeNamespace(tenantId, options);
      if (active?.businessId === tenantId) {
        await writePointer(await plain(), null);
        setActive(null);
      }
    });
  });
}

/** Forgets which shop is active, and nothing else. Use `switchStore(null)` to be asked about unsent sales first. */
export function clearActiveStore(): Promise<void> {
  return mutate(async () => {
    await ensureStorageReady();
    await writePointer(await plain(), null);
    setActive(null);
  });
}

/**
 * The headers that tell the server which shop a request is for. A shop carried over from the old
 * layout has no confirmed id yet, so only its host is sent until the server names it.
 */
export function getTenantHeaders(tenant: TenantContext): Record<string, string> {
  const headers: Record<string, string> = {};
  if (tenant.host) {
    headers['X-Tenant-Host'] = tenant.host;
  }
  if (!isProvisionalId(tenant.businessId)) {
    headers['X-Tenant-Id'] = tenant.businessId;
  }
  return headers;
}

/** The store an `openStore` call opened, or the error that explains why it did not. For callers that only catch errors. */
export function unwrapOpened(result: OpenStoreResult, input = ''): StoreSnapshot {
  if (result.kind === 'opened') {
    return result.store;
  }
  if (result.kind === 'blocked') {
    throw new StoreSwitchBlockedError(result.unsent);
  }
  throw new StoreLookupError(result, describeStoreResult(result, input));
}

/** @deprecated Use `openStore` and show the result. Kept so screens that only catch an error still work. */
export async function resolveShopperStore(input: string, baseURL: string): Promise<TenantContext> {
  return unwrapOpened(await openStore(input, baseURL, { audience: 'shopper' }), input);
}

/** @deprecated Use `openStore` and show the result. Kept so screens that only catch an error still work. */
export async function resolveTenant(input: string, baseURL: string = 'https://api.kiosk.ke'): Promise<TenantContext> {
  return unwrapOpened(await openStore(input, baseURL, { audience: 'staff' }), input);
}

/** @deprecated Use `loadActiveStore`. */
export function loadTenant(): Promise<TenantContext | null> {
  return loadActiveStore();
}

/** @deprecated Use `switchStore(null)`, which asks about unsent sales first, or `clearActiveStore`. */
export function clearTenant(): Promise<void> {
  return clearActiveStore();
}
