import { ApiClient } from '@kiosk/core';

interface MpesaStkRequest {
    phoneNumber: string;
    amount: number;
    description?: string;
}
interface MpesaStkResponse {
    accepted: boolean;
    checkoutRequestId?: string;
    message?: string;
    status: 'pending' | 'completed' | 'failed';
}
interface StkStatusResponse {
    status: string;
    success: boolean;
    failed: boolean;
    pending: boolean;
    failureReason?: string;
}
declare function initiateStkPush(api: ApiClient, request: MpesaStkRequest): Promise<MpesaStkResponse>;
declare function pollStkStatus(api: ApiClient, checkoutRequestId: string): Promise<MpesaStkResponse>;
declare function pollUntilComplete(api: ApiClient, checkoutRequestId: string, options?: {
    intervalMs?: number;
    timeoutMs?: number;
}): Promise<MpesaStkResponse>;

export { type MpesaStkRequest, type MpesaStkResponse, type StkStatusResponse, initiateStkPush, pollStkStatus, pollUntilComplete };
