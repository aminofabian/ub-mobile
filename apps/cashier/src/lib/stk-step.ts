import { isApiError } from '@kiosk/core';
import type { StkOutcome } from '@kiosk/payments';
import { formatMoney, toCents } from './money';
import { isMpesaCode, normalizeMpesaCode } from './tender';

/** The server accepts an M-Pesa payment up to a shilling away from what the prompt charged. */
export const STK_AMOUNT_TOLERANCE_CENTS = 100;

/** What the payment screen does after waiting for a customer to pay by M-Pesa. */
export type StkStep =
  /** Paid and confirmed: the sale can be completed with this code. */
  | { step: 'paid'; code: string }
  /** Paid, but the code is not known: it has to be typed from the customer's message. */
  | { step: 'code_needed'; message: string }
  /** M-Pesa received a different amount than this payment is for. Nothing is completed. */
  | { step: 'wrong_amount'; message: string }
  /** M-Pesa said the payment did not go through. A new prompt may be sent. */
  | { step: 'failed'; message: string }
  /** Nobody knows yet. The customer may still pay, or may have paid just now. No new prompt. */
  | { step: 'unconfirmed'; message: string };

export function describeStkOutcome(outcome: StkOutcome, expectedCents: number): StkStep {
  switch (outcome.kind) {
    case 'paid': {
      const paidCents = outcome.amount === null ? null : toCents(outcome.amount);
      if (paidCents !== null && Math.abs(paidCents - expectedCents) > STK_AMOUNT_TOLERANCE_CENTS) {
        return {
          step: 'wrong_amount',
          message: `M-Pesa says ${formatMoney(paidCents)} was paid, but this payment is ${formatMoney(expectedCents)}. Ask your manager before completing the sale.`,
        };
      }
      if (outcome.receiptCode === null || !isMpesaCode(outcome.receiptCode)) {
        return {
          step: 'code_needed',
          message: "The customer has paid, but M-Pesa did not send the code. Type the code from the customer's message.",
        };
      }
      return { step: 'paid', code: normalizeMpesaCode(outcome.receiptCode) };
    }
    case 'failed':
      return {
        step: 'failed',
        message: outcome.reason
          ? `M-Pesa said: ${outcome.reason}. You can send the prompt again, or take another way of paying.`
          : 'The payment did not go through. You can send the prompt again, or take another way of paying.',
      };
    case 'unknown':
      switch (outcome.reason) {
        case 'no_connection':
          return {
            step: 'unconfirmed',
            message: "Couldn't reach the server to check. The customer may have paid. Check again before sending another prompt.",
          };
        case 'cancelled':
          return {
            step: 'unconfirmed',
            message: 'You stopped waiting. The customer may still pay. Check again before sending another prompt.',
          };
        case 'timeout':
          return {
            step: 'unconfirmed',
            message: 'No answer from M-Pesa yet. The customer may still be entering their PIN, or may have just paid. Check again before sending another prompt.',
          };
      }
  }
}

/**
 * How long the till waits for the server to answer "send the prompt". The server clears the customer's number first and
 * may try again if M-Pesa still holds an earlier prompt, so a slow answer is normal. Past this it is not known whether a
 * prompt went out.
 */
export const PUSH_TIMEOUT_MS = 45_000;

/** The server did not answer "send the prompt" in time. */
export class PushTimedOut extends Error {
  constructor() {
    super('The server did not answer in time.');
    this.name = 'PushTimedOut';
  }
}

/** What the till knows after asking for a prompt and not getting a "sent" back. */
export type PushFailure =
  /** The server said no before sending anything: another prompt may be sent straight away. */
  | { sent: 'no'; message: string }
  /** No answer, or an answer that does not say: a prompt may be on the customer's phone. */
  | { sent: 'maybe'; message: string };

export function describePushFailure(error: unknown): PushFailure {
  if (isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 408) {
    const reason = error.message.trim();
    return {
      sent: 'no',
      message: reason ? `The prompt was not sent: ${reason}` : 'The prompt was not sent.',
    };
  }
  return {
    sent: 'maybe',
    message:
      "The server did not say whether the prompt went out, so it may be on the customer's phone. Ask them. If it came, ask them to pay it and type the code from their M-Pesa message below. If it did not, start again.",
  };
}
