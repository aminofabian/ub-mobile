import { readTenantValue, writeTenantValue, type ApiClient } from '@kiosk/core';
import { fetchCatalogPage } from '../api/pos-api';
import { createCatalogCopy, type CatalogCopy } from './catalog-copy';

interface Live {
  api: ApiClient;
  offline: () => boolean;
}

interface Holder {
  tenantId: string;
  branchId: string;
  live: Live;
  copy: CatalogCopy;
}

const holders = new Map<string, Holder>();

/** Lets go of every copy held in memory for a shop, when the phone is no longer a till there. */
export function dropCatalogCopies(tenantId: string): void {
  for (const [key, held] of holders) {
    if (held.tenantId === tenantId) holders.delete(key);
  }
}

/**
 * The one copy of a shop's price list for a branch on this phone. Every screen shares it, so two tries never overlap.
 * Asking again hands over the same copy, and from then on it sends through the client given last.
 *
 * The phone keeps one list for a shop, so a till that moves to another branch of the same shop makes a new copy and
 * the earlier branch's copy in memory is dropped: it would say it is on the phone when the phone holds another.
 */
export function catalogCopyFor(options: {
  tenantId: string;
  branchId: string;
  api: ApiClient;
  offline: () => boolean;
}): CatalogCopy {
  const { tenantId, branchId, api, offline } = options;
  const key = `${tenantId}\u0000${branchId}`;
  for (const [other, held] of holders) {
    if (held.tenantId === tenantId && held.branchId !== branchId) holders.delete(other);
  }
  const held = holders.get(key);
  if (held) {
    held.live.api = api;
    held.live.offline = offline;
    return held.copy;
  }
  const live: Live = { api, offline };
  const copy = createCatalogCopy({
    read: () => readTenantValue('catalog', tenantId),
    write: (text) => writeTenantValue('catalog', text, tenantId),
    fetchPage: (page, size) => fetchCatalogPage(live.api, branchId, page, size),
    branchId,
    now: Date.now,
    offline: () => live.offline(),
  });
  holders.set(key, { tenantId, branchId, live, copy });
  return copy;
}
