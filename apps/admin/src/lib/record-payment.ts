import {
  checkPayment,
  describePaymentFailure,
  paymentBody,
  paymentVerdict,
  verdictWords,
  type PaymentBody,
  type PaymentChannel,
  type PaymentVerdict,
} from './credit';
import { kesOrDash } from './owner-money';

/**
 * Recording a payment against a customer's tab, from the owner's typed amount to what the owner is told. It is the one
 * thing in the Owner app that moves money, and the server does not recognise a repeat of it, so the rules live here,
 * apart from the screen, where they can be tested:
 *
 * - the tab is read first, and the payment is checked against what the server says now, not against the list;
 * - the payment is sent at most once per call, and never again by anything in this file;
 * - a payment that got no answer is settled by reading the tab again, and the owner is told what was found. Nothing here
 *   tells the owner it is safe to send it again; whether to enter it a second time is theirs to decide, after looking.
 */

export type PaymentTools = {
  /** What the customer owes now, in cents. Throws, or answers null, when it could not be read. */
  readOwed: () => Promise<number | null>;
  /**
   * Sends the payment and answers what the server said: the claim it made and the balance it left. Throws when the
   * server turns it down and when no answer comes back.
   */
  send: (body: PaymentBody) => Promise<{ claimId: string | null; balanceCents: number | null }>;
};

export type PaymentInput = { customerId: string; name: string; typed: string; channel: PaymentChannel; reference: string };

/** What became of a payment, in the words the owner is shown. */
export type PaymentOutcome =
  /** Nothing was sent, and the words say why. */
  | { kind: 'not_sent'; tone: 'warn' | 'bad'; words: string }
  /** The server turned it down, so nothing happened. */
  | { kind: 'refused'; words: string }
  /** It is on the tab: the server said so, or the tab read again proves it. */
  | { kind: 'recorded'; words: string }
  /** No answer came and the tab does not settle it. The owner looks before anything else is recorded. */
  | { kind: 'unsettled'; verdict: PaymentVerdict; words: string; owedBeforeCents: number; paidCents: number };

async function readOwed(tools: Pick<PaymentTools, 'readOwed'>): Promise<number | null> {
  try {
    return await tools.readOwed();
  } catch {
    return null;
  }
}

/**
 * Reads the tab again and says what became of a payment that got no answer. It never sends anything. Used right after
 * a lost answer and again each time the owner asks to check.
 */
export async function judgePayment(
  tools: Pick<PaymentTools, 'readOwed'>,
  base: { owedBeforeCents: number; paidCents: number }
): Promise<Extract<PaymentOutcome, { kind: 'recorded' | 'unsettled' }>> {
  const now = await readOwed(tools);
  const verdict = paymentVerdict({ owedBeforeCents: base.owedBeforeCents, paidCents: base.paidCents, owedNowCents: now });
  const said = verdictWords(verdict, { paidCents: base.paidCents, owedNowCents: now });
  if (verdict === 'went_through') return { kind: 'recorded', words: said.words };
  return { kind: 'unsettled', verdict, words: said.words, owedBeforeCents: base.owedBeforeCents, paidCents: base.paidCents };
}

/** Records a payment, once. See the notes at the top of this file. */
export async function recordPayment(tools: PaymentTools, input: PaymentInput): Promise<PaymentOutcome> {
  const before = await readOwed(tools);
  if (before === null) {
    return { kind: 'not_sent', tone: 'warn', words: 'Could not check what they owe right now, so nothing was recorded. Check the signal and try again.' };
  }
  if (before <= 0) {
    return { kind: 'not_sent', tone: 'warn', words: `${input.name} owes nothing now, so there is nothing to record. Nothing was recorded.` };
  }
  const checked = checkPayment(before, input.typed);
  if (!checked.ok) return { kind: 'not_sent', tone: 'warn', words: `${checked.words} Nothing was recorded.` };
  const body = paymentBody({ customerId: input.customerId, cents: checked.cents, channel: input.channel, reference: input.reference });
  if (body === null) return { kind: 'not_sent', tone: 'bad', words: 'That amount cannot be sent. Nothing was recorded.' };

  const paid = kesOrDash(checked.cents);
  try {
    const answer = await tools.send(body);
    // The server makes a claim for every payment it takes, and says which. An answer without one is not the server's (a
    // hotel sign-in page, a proxy), so it proves nothing: the tab is read, as for an answer that never came.
    if (answer.claimId === null) return judgePayment(tools, { owedBeforeCents: before, paidCents: checked.cents });
    const now = answer.balanceCents ?? (await readOwed(tools));
    return {
      kind: 'recorded',
      words: now === null ? `Recorded: ${paid} paid by ${input.name}.` : `Recorded: ${paid} paid. ${input.name} now owes ${kesOrDash(now)}.`,
    };
  } catch (error) {
    const failure = describePaymentFailure(error);
    if (failure.kind === 'refused') return { kind: 'refused', words: `Not recorded. ${failure.words}` };
    return judgePayment(tools, { owedBeforeCents: before, paidCents: checked.cents });
  }
}
