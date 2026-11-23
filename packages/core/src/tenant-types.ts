export interface TenantContext {
  /**
   * The tenant's id, as the server issues it. The name is older than the plan and is sent as the
   * X-Tenant-Id header, so it stays.
   */
  businessId: string;
  slug: string;
  /** The host to send as X-Tenant-Host: the shop's primary domain, as the server reports it. */
  host: string;
  displayName: string;
  branding: Record<string, unknown>;
  /** Lifecycle status from the server (ACTIVE, SUSPENDED, INACTIVE). Absent on contexts saved before Phase 0b. */
  status?: string;
  storefrontEnabled?: boolean;
  /**
   * The shop's formats as the server names them, for example `['mini-mart']` or `['restaurant', 'lodging']`
   * (plan §5.6). Absent until the server sends it, which is not the same as an empty list.
   */
  storeTypes?: string[];
  /**
   * What the apps may offer in this shop, worked out by the server (plan §5.6). A name that is missing is
   * unknown, not false: only an explicit `false` takes something away.
   */
  capabilities?: Record<string, boolean>;
  /** ISO time the server last confirmed this shop. */
  fetchedAt?: string;
}

/** What `previewStore` returns and `activateStore` persists (plan §5.2). */
export type StoreSnapshot = TenantContext & { fetchedAt: string };

export type UnavailableReason = 'suspended' | 'storefront_disabled' | 'not_listed';

/**
 * Every way finding a shop can end. A network failure and a server error both come back as
 * `offline`: either way the app has no answer yet and should say so and offer to retry.
 */
export type StoreResult =
  | { kind: 'found'; store: StoreSnapshot }
  | { kind: 'unavailable'; reason: UnavailableReason; store?: StoreSnapshot }
  | { kind: 'not_found' }
  | { kind: 'offline' }
  | { kind: 'rate_limited'; retryAfterSec?: number };

/** Who is asking. A shop with its storefront switched off is still a shop for its own staff. */
export type StoreAudience = 'shopper' | 'staff';

export interface UnsentSummary {
  total: number;
  needsAttention: number;
}
