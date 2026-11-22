import { readTenantSecret, removeTenantSecret, writeTenantSecret } from './tenant-data';
import { getActiveTenantId, loadStoreById } from './tenant';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Tokens belong to a shop. Every function takes the shop's id and, without one, acts on the active
 * shop. Callers that start an operation in one shop and finish it later (a refresh that was waiting
 * on the network) should pass the id they started with, so the result cannot land in another shop.
 */

/**
 * Stores a session for a shop. A shop this phone has no record of (forgotten while the request was
 * in flight) gets nothing stored, so a removed shop cannot leave a session behind.
 */
export async function storeTokens(tokens: AuthTokens, tenantId?: string): Promise<void> {
  const id = tenantId ?? (await getActiveTenantId());
  if (!id) {
    throw new Error('Select a store first before signing in.');
  }
  if (!(await loadStoreById(id))) {
    return;
  }
  await writeTenantSecret('accessToken', tokens.accessToken, id);
  await writeTenantSecret('refreshToken', tokens.refreshToken, id);
}

export async function getAccessToken(tenantId?: string): Promise<string | null> {
  return readTenantSecret('accessToken', tenantId);
}

export async function getRefreshToken(tenantId?: string): Promise<string | null> {
  return readTenantSecret('refreshToken', tenantId);
}

export async function clearTokens(tenantId?: string): Promise<void> {
  await removeTenantSecret('accessToken', tenantId);
  await removeTenantSecret('refreshToken', tenantId);
}
