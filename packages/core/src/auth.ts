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
 * Shops whose session this phone ended on purpose (a sign-out) and that nobody has signed in to since. Until then
 * nothing may bring that session back: a request that was already on its way when the person signed out could
 * ask for a refresh with no token of its own and be answered from the cookie the phone still holds, and a
 * signed-out person would be signed in again. Kept in memory: after a restart no such request exists.
 */
const sessionsEnded = new Set<string>();

export function markSessionEnded(tenantId: string): void {
  sessionsEnded.add(tenantId);
}

export function sessionWasEnded(tenantId: string): boolean {
  return sessionsEnded.has(tenantId);
}

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
  // Someone has signed in: the shop has a session again.
  sessionsEnded.delete(id);
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
