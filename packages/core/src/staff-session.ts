import type { ApiClient } from './create-api-client';
import { parseMe, type StaffUser } from './staff-user';
import { DEFAULT_TIMEOUT_MS, getJson } from './tenant-resolve';

/** Who is signed in, from the server. Throws when the answer is not a person with a role. */
export async function fetchMe(api: ApiClient): Promise<StaffUser> {
  const user = parseMe(await api.get<unknown>('/api/v1/me'));
  if (!user) {
    throw new Error('Could not read your account. Try again.');
  }
  return user;
}

/** True when the shop runs without shifts: the till never asks for one (capability `shiftsDisabled`, plan §5.6). */
export function shiftsAreDisabled(shop: { capabilities?: Record<string, boolean> } | null | undefined): boolean {
  return shop?.capabilities?.shiftsDisabled === true;
}

/**
 * "Shifts are off" as the shop's public address says it: the feature flags on the host lookup carry
 * `shifts.disabled` when the owner turned shifts off. Only a real `true` counts.
 */
export function readShiftsDisabled(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const flags = (body as { featureFlags?: unknown }).featureFlags;
  if (!flags || typeof flags !== 'object') return false;
  return (flags as Record<string, unknown>)['shifts.disabled'] === true;
}

/**
 * Whether this shop runs without shifts, asked of the public host lookup the web storefront already uses.
 * Until `/mobile` carries a `shiftsDisabled` capability this is the only way the app can know. Any failure,
 * or a shop with no address, answers false: the person is offered a shift, which always works.
 */
export async function fetchShiftsDisabled(
  baseURL: string,
  host: string | undefined,
  options: { timeoutMs?: number } = {}
): Promise<boolean> {
  const address = host?.trim();
  if (!address) return false;
  const base = baseURL.replace(/\/+$/, '');
  const fetched = await getJson(
    `${base}/api/v1/public/host/resolve?host=${encodeURIComponent(address)}`,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  if (fetched.kind !== 'response' || fetched.status !== 200) return false;
  return readShiftsDisabled(fetched.body);
}
