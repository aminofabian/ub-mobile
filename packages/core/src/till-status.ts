import type { ApiClient } from './create-api-client';
import { isApiError } from './problem';
import { readTenantValue, removeTenantValue, writeTenantValue } from './tenant-data';

/**
 * Whether this phone is still a registered till (plan §5.5, §5.12.4 #13).
 *
 * `GET /api/v1/till-devices/me` answers 404 for a phone that was never registered, for one that was
 * revoked, and for every phone in a branch that has no registered tills at all. So a 404 alone does
 * not mean "removed". It means that only for a phone the app already knows was registered at this
 * branch: it was paired here, or this same question was answered 200 here once.
 */

export type TillCheck =
  | 'registered'
  /** It was a registered till here and no longer is. */
  | 'removed'
  /** The server does not know this phone as a till, and the app has no reason to think it should. */
  | 'not_registered'
  /** The shop is switched off (a lapsed subscription): the server answers 423, and every other call would too. */
  | 'shop_off'
  /** No answer: offline, or the server failed. Say nothing and keep working. */
  | 'unknown';

export type TillAnswer = 'registered' | 'not_found' | 'shop_off' | 'failed';

export function interpretTillAnswer(answer: TillAnswer, registeredHere: boolean): TillCheck {
  switch (answer) {
    case 'registered':
      return 'registered';
    case 'not_found':
      return registeredHere ? 'removed' : 'not_registered';
    case 'shop_off':
      return 'shop_off';
    case 'failed':
      return 'unknown';
  }
}

/** Remembers that this phone is a registered till for this branch: after a pairing, or a 200. */
export async function rememberTillRegistered(tenantId: string, branchId: string): Promise<void> {
  await writeTenantValue('tillSeen', branchId, tenantId);
}

export async function forgetTillRegistered(tenantId: string): Promise<void> {
  await removeTenantValue('tillSeen', tenantId);
}

export async function checkTillRegistration(
  api: ApiClient,
  tenantId: string,
  branchId: string
): Promise<TillCheck> {
  let answer: TillAnswer;
  try {
    await api.get(`/api/v1/till-devices/me?branchId=${encodeURIComponent(branchId)}`);
    answer = 'registered';
  } catch (error) {
    answer = isApiError(error) && error.status === 404 ? 'not_found' : isApiError(error) && error.status === 423 ? 'shop_off' : 'failed';
  }
  if (answer === 'registered') {
    await rememberTillRegistered(tenantId, branchId);
    return 'registered';
  }
  if (answer === 'failed') {
    return 'unknown';
  }
  const seenAt = await readTenantValue('tillSeen', tenantId);
  return interpretTillAnswer(answer, seenAt === branchId);
}
