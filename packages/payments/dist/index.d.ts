import { ApiClient } from '@kiosk/core';

interface MpesaStkRequest {
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
interface MpesaStkResponse {
    accepted: boolean;
    checkoutRequestId?: string;
    message?: string;
    status: 'pending' | 'completed' | 'failed';
    /** The M-Pesa receipt code, once the payment has gone through. */
    receiptCode?: string;
    /** What the server confirmed was paid, in shillings. */
    amount?: number;
}
interface StkStatusResponse {
    status: string;
    success: boolean;
    failed: boolean;
    pending: boolean;
    failureReason?: string;
    /** The M-Pesa receipt code. */
    gatewayTransactionId?: string | null;
    amount?: number | null;
}
declare function initiateStkPush(api: ApiClient, request: MpesaStkRequest): Promise<MpesaStkResponse>;
declare function pollStkStatus(api: ApiClient, checkoutRequestId: string): Promise<MpesaStkResponse>;
/**
 * How waiting for a customer to pay ended. Only `paid` and `failed` are answers from M-Pesa. `unknown` means nobody
 * knows yet: the customer may still pay, or may have paid just now, so it must never be shown as a failure and a
 * second prompt must not be sent as if the first had not worked.
 */
type StkOutcome = {
    kind: 'paid';
    checkoutRequestId: string;
    receiptCode: string | null;
    amount: number | null;
} | {
    kind: 'failed';
    checkoutRequestId: string;
    reason?: string;
} | {
    kind: 'unknown';
    checkoutRequestId: string;
    reason: 'timeout' | 'no_connection' | 'cancelled';
};
interface WaitForStkOptions {
    intervalMs?: number;
    timeoutMs?: number;
    /** How long one status check may take before it is given up on (the next one may do better). */
    pollTimeoutMs?: number;
    /** Stops the wait at once, wherever it is. */
    signal?: AbortSignal;
    /** For tests. */
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
    now?: () => number;
}
/**
 * Asks for the payment's status until the customer has paid, M-Pesa says it failed, the time runs out or the caller
 * stops it. A check that cannot be made (no connection, a server error, no answer in time) is only skipped: one bad
 * moment does not end the wait, because the customer may be entering their PIN right then. A check that never comes
 * back cannot hold the wait either, and stopping the wait does not have to wait for it.
 */
declare function waitForStk(api: ApiClient, checkoutRequestId: string, options?: WaitForStkOptions): Promise<StkOutcome>;

export { type MpesaStkRequest, type MpesaStkResponse, type StkOutcome, type StkStatusResponse, type WaitForStkOptions, initiateStkPush, pollStkStatus, waitForStk };
