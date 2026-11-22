import { getEmbeddedTenantSlug } from './embedded-config';
import { tenantHost } from './mobile-config';
import {
  StoreLookupError,
  activateStore,
  clearActiveStore,
  describeStoreResult,
  loadActiveStore,
  previewStore,
  revalidateActive,
  type StoreAudience,
  type StoreResult,
  type StoreSnapshot,
  type TenantContext,
} from './tenant';

export { getEmbeddedTenantSlug, getTenantDisplayName, isWhiteLabelApp } from './embedded-config';

export type BootResult =
  | { kind: 'ready'; store: StoreSnapshot; source: 'device' | 'server' }
  /** A build that serves any shop, with none chosen yet: show the picker. */
  | { kind: 'picker' }
  /** A build made for one shop that could not be found, or reached, on first launch. */
  | Exclude<StoreResult, { kind: 'found' }>;

/**
 * Opens the shop for this launch. The shop saved on the device opens immediately, with no network,
 * and the server is asked about it afterwards in the background. Only when nothing is saved does a
 * build made for one shop look that shop up, using the host or slug baked in at build time.
 */
export async function bootstrapStore(
  baseURL: string,
  options: { audience: StoreAudience } = { audience: 'staff' },
): Promise<BootResult> {
  const embeddedSlug = getEmbeddedTenantSlug();
  const bakedHost = tenantHost();
  const saved = await loadActiveStore();

  if (saved) {
    const slugMismatch = Boolean(embeddedSlug && saved.slug.toLowerCase() !== embeddedSlug.toLowerCase());
    const hostMismatch = Boolean(bakedHost && saved.host && saved.host.toLowerCase() !== bakedHost);
    if (!slugMismatch && !hostMismatch) {
      void revalidateActive(baseURL, options).catch(() => undefined);
      return { kind: 'ready', store: saved, source: 'device' };
    }
    // A build made for one shop found another one saved. Its own data stays; it just is not the active shop.
    await clearActiveStore();
  }

  const input = bakedHost ?? embeddedSlug;
  if (!input) {
    return { kind: 'picker' };
  }

  const result = await previewStore(input, baseURL, options);
  if (result.kind !== 'found') {
    return result;
  }
  await activateStore(result.store);
  return { kind: 'ready', store: result.store, source: 'server' };
}

/**
 * Same as `bootstrapStore` for callers that want the shop or null (a build that serves any shop and
 * needs the picker), and an error otherwise.
 */
export async function bootstrapTenant(
  baseURL: string,
  options: { audience?: StoreAudience } = {},
): Promise<TenantContext | null> {
  const result = await bootstrapStore(baseURL, { audience: options.audience ?? 'staff' });
  if (result.kind === 'ready') {
    return result.store;
  }
  if (result.kind === 'picker') {
    return null;
  }
  throw new StoreLookupError(result, describeStoreResult(result, getEmbeddedTenantSlug() ?? ''));
}
