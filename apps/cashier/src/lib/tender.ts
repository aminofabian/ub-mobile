import { formatMoney, fromCents } from './money';

/**
 * How a sale is paid, worked out in whole cents and turned into what the server takes (see `money.ts`).
 *
 * Two server rules shape it (SaleService, read 2026-11-23):
 *  - The payments must add up to exactly what is due. More than that and, when a customer is linked to the sale, the
 *    extra is credited to that customer's wallet, not handed back as change. So each payment is sent at its exact
 *    share, and the notes the customer actually handed over travel separately as `cashReceived`.
 *  - An M-Pesa payment is the tender `mpesa_manual`, with the M-Pesa receipt code as its reference. The server checks
 *    the code against the prompt it sent and refuses an amount more than a shilling away from what was charged. A
 *    prompt charges whole shillings, so an M-Pesa share is always whole shillings.
 */

export type Tender =
  /** `handedCents`: the notes the customer put down. It may be more than `cents`; the difference is the change. */
  | { kind: 'cash'; cents: number; handedCents?: number }
  | { kind: 'mpesa'; cents: number; code: string }
  | { kind: 'credit'; cents: number };

export type TenderKind = Tender['kind'];

/** One payment as the server takes it. `amount` is in shillings. */
export interface SalePayment {
  method: 'cash' | 'mpesa_manual' | 'customer_credit';
  amount: number;
  reference?: string;
}

export type PlanProblem =
  | 'no_total'
  | 'no_tender'
  | 'bad_amount'
  | 'repeated'
  | 'mpesa_whole'
  | 'mpesa_code'
  | 'credit_customer'
  | 'short'
  | 'over'
  | 'cash_handed_short';

export type Plan =
  | { ok: true; payments: SalePayment[]; cashReceived?: number; changeCents: number }
  /** `cents` is how far off the payments are, for `short` and `over`. */
  | { ok: false; problem: PlanProblem; cents?: number };

export interface PlanRequest {
  totalCents: number;
  tenders: Tender[];
  /** The customer linked to the sale. Credit needs one. */
  customerId?: string | null;
}

/** The server looks a sale up by M-Pesa code when it is 6 to 20 letters and digits. */
export const MPESA_CODE_MIN = 6;
export const MPESA_CODE_MAX = 20;
/** What a real M-Pesa receipt code is. Another length is allowed (the server allows it) but worth a second look. */
export const MPESA_CODE_USUAL = 10;

const ORDER: TenderKind[] = ['cash', 'mpesa', 'credit'];

function isPositiveCents(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/** The code as the server keeps it: upper case, letters and digits only. */
export function normalizeMpesaCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** True when the server will take this as an M-Pesa code. */
export function isMpesaCode(raw: string): boolean {
  const code = normalizeMpesaCode(raw);
  return code.length >= MPESA_CODE_MIN && code.length <= MPESA_CODE_MAX;
}

/** True when the code is acceptable but not the usual length, so the cashier should check what they typed. */
export function mpesaCodeLooksOdd(raw: string): boolean {
  return normalizeMpesaCode(raw).length !== MPESA_CODE_USUAL;
}

/** Cents cut down to whole shillings. What an M-Pesa prompt can charge of an amount with cents in it. */
export function wholeShillings(cents: number): number {
  return Math.floor(cents / 100) * 100;
}

function fail(problem: PlanProblem, cents?: number): Plan {
  return cents === undefined ? { ok: false, problem } : { ok: false, problem, cents };
}

/** Checks how the customer is paying against what is due, and builds exactly what the server is sent. */
export function planPayments({ totalCents, tenders, customerId }: PlanRequest): Plan {
  if (!isPositiveCents(totalCents)) return fail('no_total');
  if (tenders.length === 0) return fail('no_tender');

  const seen = new Set<TenderKind>();
  for (const tender of tenders) {
    if (!isPositiveCents(tender.cents)) return fail('bad_amount');
    if (seen.has(tender.kind)) return fail('repeated');
    seen.add(tender.kind);
  }

  for (const tender of tenders) {
    if (tender.kind === 'mpesa') {
      if (tender.cents % 100 !== 0) return fail('mpesa_whole');
      if (!isMpesaCode(tender.code)) return fail('mpesa_code');
    }
    if (tender.kind === 'credit' && !(typeof customerId === 'string' && customerId.trim())) {
      return fail('credit_customer');
    }
  }

  const sum = tenders.reduce((total, tender) => total + tender.cents, 0);
  if (sum < totalCents) return fail('short', totalCents - sum);
  if (sum > totalCents) return fail('over', sum - totalCents);

  const payments: SalePayment[] = [];
  let cashReceived: number | undefined;
  let changeCents = 0;
  for (const tender of [...tenders].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))) {
    switch (tender.kind) {
      case 'cash': {
        if (tender.handedCents !== undefined) {
          if (!Number.isSafeInteger(tender.handedCents) || tender.handedCents < tender.cents) {
            return fail('cash_handed_short');
          }
          cashReceived = fromCents(tender.handedCents);
          changeCents = tender.handedCents - tender.cents;
        }
        payments.push({ method: 'cash', amount: fromCents(tender.cents) });
        break;
      }
      case 'mpesa':
        payments.push({ method: 'mpesa_manual', amount: fromCents(tender.cents), reference: normalizeMpesaCode(tender.code) });
        break;
      case 'credit':
        payments.push({ method: 'customer_credit', amount: fromCents(tender.cents) });
        break;
    }
  }

  return cashReceived === undefined ? { ok: true, payments, changeCents } : { ok: true, payments, cashReceived, changeCents };
}

/** What to tell the cashier when a plan cannot be made. */
export function describePlanProblem(plan: Extract<Plan, { ok: false }>): string {
  switch (plan.problem) {
    case 'no_total':
      return 'There is nothing to pay yet.';
    case 'no_tender':
      return 'Choose how the customer is paying.';
    case 'bad_amount':
      return 'Enter an amount for each way of paying.';
    case 'repeated':
      return 'Each way of paying can only be used once.';
    case 'mpesa_whole':
      return 'M-Pesa takes whole shillings. Take the cents in cash.';
    case 'mpesa_code':
      return "Enter the M-Pesa code from the customer's message.";
    case 'credit_customer':
      return 'Choose the customer who is taking this on credit.';
    case 'short':
      return plan.cents === undefined ? 'The payments do not cover the total.' : `Still to pay ${formatMoney(plan.cents)}.`;
    case 'over':
      return plan.cents === undefined ? 'The payments are more than the total.' : `That is ${formatMoney(plan.cents)} more than the total.`;
    case 'cash_handed_short':
      return 'The cash handed over is less than the cash to take.';
  }
}

const NOTE_STEPS = [5000, 10000, 50000, 100000];

/**
 * Amounts a customer is likely to hand over for a cash payment: the exact amount first, then what rounds it up to the
 * next 50, 100, 500 and 1,000 shillings. Always in ascending order, never repeating an amount.
 */
export function cashSuggestions(dueCents: number): number[] {
  if (!isPositiveCents(dueCents)) return [];
  const amounts = [dueCents];
  for (const step of NOTE_STEPS) {
    const roundedUp = Math.ceil(dueCents / step) * step;
    if (roundedUp > amounts[amounts.length - 1]) amounts.push(roundedUp);
  }
  return amounts;
}
