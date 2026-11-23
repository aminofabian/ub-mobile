import type { ApiClient } from '@kiosk/core';

export interface MpesaStkRequest {
  phoneNumber: string;
  /** Whole shillings: the prompt charges whole shillings. */
  amount: number;
  description?: string;
  /**
   * One key for one attempt to collect this payment. The server uses it as the prompt's reference, so sending the
   * same key again for the same attempt is recognised as the same attempt. Without one, each call gets a new key.
   */
  idempotencyKey?: string;
}

export interface MpesaStkResponse {
  accepted: boolean;
  checkoutRequestId?: string;
  message?: string;
  status: 'pending' | 'completed' | 'failed';
  /** The M-Pesa receipt code, once the payment has gone through. */
  receiptCode?: string;
  /** What the server confirmed was paid, in shillings. */
  amount?: number;
}

export interface StkStatusResponse {
  status: string;
  success: boolean;
  failed: boolean;
  pending: boolean;
  failureReason?: string;
  /** The M-Pesa receipt code. */
  gatewayTransactionId?: string | null;
  amount?: number | null;
}

export async function initiateStkPush(
  api: ApiClient,
  request: MpesaStkRequest
): Promise<MpesaStkResponse> {
  const response = await api.post<{
    accepted: boolean;
    checkoutRequestId?: string;
    message?: string;
  }>(
    '/api/v1/payments/mpesa/stk/push',
    {
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      description: request.description ?? 'POS payment',
    },
    request.idempotencyKey
      ? { idempotent: true, idempotencyKey: request.idempotencyKey }
      : { idempotent: true }
  );

  return {
    accepted: response.accepted,
    checkoutRequestId: response.checkoutRequestId,
    message: response.message,
    status: response.accepted ? 'pending' : 'failed',
  };
}

function readStatus(response: StkStatusResponse): Pick<MpesaStkResponse, 'status' | 'receiptCode' | 'amount'> {
  if (response.success) {
    const code = typeof response.gatewayTransactionId === 'string' ? response.gatewayTransactionId.trim() : '';
    return {
      status: 'completed',
      ...(code ? { receiptCode: code } : {}),
      ...(typeof response.amount === 'number' && Number.isFinite(response.amount) ? { amount: response.amount } : {}),
    };
  }
  // A status that is neither a success nor a failure is still waiting, whatever it is called.
  return { status: response.failed ? 'failed' : 'pending' };
}

export async function pollStkStatus(
  api: ApiClient,
  checkoutRequestId: string
): Promise<MpesaStkResponse> {
  const response = await api.get<StkStatusResponse>(
    `/api/v1/payments/mpesa/stk/push/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`
  );

  return {
    accepted: true,
    checkoutRequestId,
    message: response.failureReason,
    ...readStatus(response),
  };
}

/**
 * How waiting for a customer to pay ended. Only `paid` and `failed` are answers from M-Pesa. `unknown` means nobody
 * knows yet: the customer may still pay, or may have paid just now, so it must never be shown as a failure and a
 * second prompt must not be sent as if the first had not worked.
 */
export type StkOutcome =
  | { kind: 'paid'; checkoutRequestId: string; receiptCode: string | null; amount: number | null }
  | { kind: 'failed'; checkoutRequestId: string; reason?: string }
  | { kind: 'unknown'; checkoutRequestId: string; reason: 'timeout' | 'no_connection' | 'cancelled' };

export interface WaitForStkOptions {
  intervalMs?: number;
  timeoutMs?: number;
  /** Stops the wait at once, wherever it is. */
  signal?: AbortSignal;
  /** For tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
}

function sleepFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done);
  });
}

/**
 * Asks for the payment's status until the customer has paid, M-Pesa says it failed, the time runs out or the caller
 * stops it. A check that cannot be made (no connection, a server error) is only skipped: one bad moment does not end
 * the wait, because the customer may be entering their PIN right then.
 */
export async function waitForStk(
  api: ApiClient,
  checkoutRequestId: string,
  options: WaitForStkOptions = {}
): Promise<StkOutcome> {
  const { intervalMs = 3000, timeoutMs = 90_000, signal, sleep = sleepFor, now = Date.now } = options;
  const started = now();
  let answered = false;

  while (!signal?.aborted) {
    try {
      const status = await pollStkStatus(api, checkoutRequestId);
      answered = true;
      if (status.status === 'completed') {
        return {
          kind: 'paid',
          checkoutRequestId,
          receiptCode: status.receiptCode ?? null,
          amount: status.amount ?? null,
        };
      }
      if (status.status === 'failed') {
        return { kind: 'failed', checkoutRequestId, ...(status.message ? { reason: status.message } : {}) };
      }
    } catch {
      // This check could not be made. The next one may.
    }

    if (signal?.aborted) break;
    if (now() - started + intervalMs >= timeoutMs) {
      return { kind: 'unknown', checkoutRequestId, reason: answered ? 'timeout' : 'no_connection' };
    }
    await sleep(intervalMs, signal);
  }

  return { kind: 'unknown', checkoutRequestId, reason: 'cancelled' };
}
