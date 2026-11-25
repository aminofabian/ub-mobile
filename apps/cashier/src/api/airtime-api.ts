import { generateIdempotencyKey, type ApiClient } from '@kiosk/core';

/**
 * Selling M-Pesa airtime from the till — a daily revenue line in many Kenyan dukas. The cashier
 * enters the customer's phone and an amount; the shop's airtime float pays the telco and the till
 * keeps a commission. The order confirms asynchronously (the telco answers in a moment), so the
 * screen shows it on its way and the status settles shortly after. Endpoints: `GET airtime/settings`
 * (is it on, min/max, float), `POST airtime/orders` (sell). Selling needs `airtime.sell`.
 */

export interface AirtimeSettings {
  /** The shop has airtime switched on and the till may sell it. */
  sellable: boolean;
  minAmount: number;
  maxAmount: number;
  commissionPercent: number;
  /** The shop's airtime float — what pays the telco. */
  walletBalance: number;
  /** Why selling is blocked right now, when it is. */
  blockedReason: string | null;
}

export interface AirtimeOrder {
  id: string;
  phoneNumber: string;
  amount: number;
  commission: number;
  status: string;
  failureReason: string | null;
  walletBalanceAfter: number | null;
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function toStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Whether the shop sells airtime, and the limits + float. Null-safe; returns a "not sellable" shape on failure. */
export async function fetchAirtimeSettings(api: ApiClient): Promise<AirtimeSettings> {
  try {
    const raw = (await api.get<unknown>('/api/v1/airtime/settings')) as Record<string, unknown>;
    const enabled = raw?.enabled === true && raw?.posEnabled === true;
    return {
      sellable: enabled && !raw?.blockedReason,
      minAmount: toNum(raw?.minAmount) || 5,
      maxAmount: toNum(raw?.maxAmount) || 10000,
      commissionPercent: toNum(raw?.commissionPercent),
      walletBalance: toNum(raw?.walletBalance),
      blockedReason: typeof raw?.blockedReason === 'string' ? raw.blockedReason : null,
    };
  } catch {
    return { sellable: false, minAmount: 5, maxAmount: 10000, commissionPercent: 0, walletBalance: 0, blockedReason: null };
  }
}

/** Sell airtime to a phone. Idempotent on its key, so a retry after a timeout sends one order, not two. */
export async function sellAirtime(
  api: ApiClient,
  body: { phoneNumber: string; amount: number; tender: 'CASH' | 'MPESA' }
): Promise<AirtimeOrder> {
  const raw = (await api.post<Record<string, unknown>>(
    '/api/v1/airtime/orders',
    { phoneNumber: body.phoneNumber, amount: body.amount, tender: body.tender },
    { idempotencyKey: generateIdempotencyKey() }
  )) as Record<string, unknown>;
  return {
    id: toStr(raw?.id),
    phoneNumber: toStr(raw?.phoneNumber) || body.phoneNumber,
    amount: toNum(raw?.amount) || body.amount,
    commission: toNum(raw?.commission),
    status: toStr(raw?.status) || 'PENDING',
    failureReason: typeof raw?.failureReason === 'string' ? raw.failureReason : null,
    walletBalanceAfter: raw?.walletBalanceAfter != null ? toNum(raw.walletBalanceAfter) : null,
  };
}
