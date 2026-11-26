import type { ApiClient } from './create-api-client';
import { getOrCreateTillDeviceId } from './till-device';

export interface TillAccessAsk {
  branchId: string;
  /** Defaults to this phone's till id for the shop when omitted. */
  deviceKey?: string;
  /** Optional label shown to the owner (phone model, etc.). */
  deviceName?: string;
}

/**
 * Asks the shop to trust this phone as a till. Creates / refreshes a pending access request
 * and notifies owners (in-app, email, WhatsApp) when the quiet period allows.
 *
 * Fire-and-forget from entry: never throws to the caller. Returns false when the ask could not
 * be sent (no device key, offline, or the server refused).
 */
export async function requestTillAccess(api: ApiClient, ask: TillAccessAsk): Promise<boolean> {
  const branchId = ask.branchId?.trim() ?? '';
  if (!branchId) return false;

  const deviceKey = (ask.deviceKey?.trim() || (await getOrCreateTillDeviceId(api.tenantId))) || '';
  if (!deviceKey) return false;

  try {
    await api.post<void>('/api/v1/till-access-requests', {
      branchId,
      deviceKey,
      ...(ask.deviceName?.trim() ? { deviceName: ask.deviceName.trim() } : {}),
    });
    return true;
  } catch {
    return false;
  }
}
