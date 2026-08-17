import type { ApiClient } from '@kiosk/core';

export interface MpesaStkRequest {
  phoneNumber: string;
  amount: number;
  description?: string;
}

export interface MpesaStkResponse {
  accepted: boolean;
  checkoutRequestId?: string;
  message?: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface StkStatusResponse {
  status: string;
  success: boolean;
  failed: boolean;
  pending: boolean;
  failureReason?: string;
}

export async function initiateStkPush(
  api: ApiClient,
  request: MpesaStkRequest
): Promise<MpesaStkResponse> {
  const response = await api.post<{
    accepted: boolean;
    checkoutRequestId?: string;
    message?: string;
  }>('/api/v1/payments/mpesa/stk/push', {
    phoneNumber: request.phoneNumber,
    amount: request.amount,
    description: request.description ?? 'POS payment',
  }, { idempotent: true });

  return {
    accepted: response.accepted,
    checkoutRequestId: response.checkoutRequestId,
    message: response.message,
    status: response.accepted ? 'pending' : 'failed',
  };
}

export async function pollStkStatus(
  api: ApiClient,
  checkoutRequestId: string
): Promise<MpesaStkResponse> {
  const response = await api.get<StkStatusResponse>(
    `/api/v1/payments/mpesa/stk/push/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`
  );

  let status: MpesaStkResponse['status'] = 'pending';
  if (response.success) status = 'completed';
  else if (response.failed) status = 'failed';

  return {
    accepted: true,
    checkoutRequestId,
    message: response.failureReason,
    status,
  };
}

export async function pollUntilComplete(
  api: ApiClient,
  checkoutRequestId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<MpesaStkResponse> {
  const { intervalMs = 3000, timeoutMs = 120_000 } = options;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const status = await pollStkStatus(api, checkoutRequestId);
    if (status.status !== 'pending') {
      return status;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return {
    accepted: true,
    checkoutRequestId,
    message: 'Payment timed out',
    status: 'failed',
  };
}
