import { classifyWrite, cleanDisplayText, isApiError } from '@kiosk/core';
import { centsToAmount, kesOrDash, signedCents, typedCents } from './owner-money';
import { dialable, phoneSearchDigits } from './phone';

/**
 * Credit as the owner works with it: who owes the shop what, and a payment the owner records when they are paid.
 * Recording a payment is a money write that the server does not recognise a repeat of (its route reads no
 * Idempotency-Key and applies the amount at once), so it is sent once, and a request that got no answer is settled by
 * reading the balance again and letting the person decide, never by sending it again.
 */

export type CreditTab = {
  customerId: string;
  name: string;
  /** Digits and a leading plus only, so it is safe to dial. Null when the server gave none or it is not a number. */
  phone: string | null;
  owedCents: number;
  /** The shop has stopped further credit for this customer. */
  suspended: boolean;
};

/** The most tabs the list holds. The server's list is not paged; a shop with more than this narrows it by searching. */
export const MAX_TABS = 300;
const MAX_ID_LENGTH = 64;
const MAX_QUERY = 60;

/**
 * The path of the list of open tabs, narrowed by a search when there is one. A number is searched by the digits that
 * every way of writing it shares (see `phoneSearchDigits`), because the server keeps numbers as digits only.
 */
export function tabsPath(query: string): string {
  const q = cleanDisplayText(query, MAX_QUERY);
  const asked = phoneSearchDigits(q) ?? q;
  return asked ? `/api/v1/customers/outstanding-tabs?q=${encodeURIComponent(asked)}` : '/api/v1/customers/outstanding-tabs';
}

/** The path of one customer, whose answer carries the balance the app reads back after a payment. */
export function customerPath(customerId: string): string {
  return `/api/v1/customers/${encodeURIComponent(customerId)}`;
}

function readTab(raw: unknown): CreditTab | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const customerId = typeof row.customerId === 'string' ? row.customerId.trim() : '';
  if (customerId.length === 0 || customerId.length > MAX_ID_LENGTH) return null;
  // A tab with nothing owed, or an amount that cannot be read, is not one the owner can take a payment on.
  const owed = signedCents(row.balanceOwed);
  if (owed === null || owed <= 0) return null;
  return {
    customerId,
    name: cleanDisplayText(row.name, 60) || 'Customer',
    phone: dialable(row.primaryPhone),
    owedCents: owed,
    suspended: row.creditSuspended === true,
  };
}

/** The biggest tab first; the same amount by name, then by id, so the list never shuffles between reads. */
export function sortTabs(tabs: readonly CreditTab[]): CreditTab[] {
  return [...tabs].sort((a, b) => b.owedCents - a.owedCents || a.name.localeCompare(b.name) || a.customerId.localeCompare(b.customerId));
}

/** What the owner has in the sum of the tabs that are listed. */
export function totalOwedCents(tabs: readonly Pick<CreditTab, 'owedCents'>[]): number {
  return tabs.reduce((sum, tab) => sum + tab.owedCents, 0);
}

/**
 * The tabs in the server's list (a bare list; a page is read too), the biggest first, at most {@link MAX_TABS}, and how
 * many more there were. Null when the answer is neither, which is a failed read and not "nobody owes anything".
 */
export function readTabs(raw: unknown): { tabs: CreditTab[]; omitted: number } | null {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { content?: unknown }).content)
      ? (raw as { content: unknown[] }).content
      : null;
  if (!rows) return null;
  const seen = new Set<string>();
  const tabs: CreditTab[] = [];
  for (const row of rows) {
    const tab = readTab(row);
    if (tab && !seen.has(tab.customerId)) {
      seen.add(tab.customerId);
      tabs.push(tab);
    }
  }
  const sorted = sortTabs(tabs);
  return { tabs: sorted.slice(0, MAX_TABS), omitted: Math.max(0, sorted.length - MAX_TABS) };
}

export type CreditSummary = {
  /** Everything owed across the shop's open tabs. */
  owedCents: number | null;
  openTabs: number | null;
  /** Paid in on tabs today. */
  collectedCents: number | null;
  paymentCount: number | null;
};

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** The answer of `GET /api/v1/credits/activity-summary` for today. Null when it is not an object. */
export function readCreditSummary(raw: unknown): CreditSummary | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  return {
    owedCents: signedCents(row.totalOwed),
    openTabs: count(row.openTabCount),
    collectedCents: signedCents(row.totalPaid),
    paymentCount: count(row.paymentCount),
  };
}

export type PaymentChannel = 'cash' | 'mpesa';

export const PAYMENT_CHANNELS: readonly { key: PaymentChannel; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'mpesa', label: 'M-Pesa' },
];

export type PaymentCheck = { ok: true; cents: number } | { ok: false; words: string };

/** Whether what was typed can be recorded against a tab of this size. The server refuses more than is owed, and so does the app. */
export function checkPayment(owedCents: number, typed: string): PaymentCheck {
  if (typed.trim() === '') return { ok: false, words: 'Type how much was paid.' };
  const cents = typedCents(typed);
  if (cents === null) return { ok: false, words: 'Type an amount like 500 or 500.50, with no commas or letters.' };
  if (cents <= 0) return { ok: false, words: 'The amount must be more than zero.' };
  if (cents > owedCents) return { ok: false, words: `This tab is only ${kesOrDash(owedCents)}. A payment cannot be more than what is owed.` };
  return { ok: true, cents };
}

export type PaymentBody = { customerId: string; amount: number; channel: PaymentChannel; reference?: string };

/**
 * What `POST /api/v1/credits/tab-payments` takes. A reference (the M-Pesa code) is only sent with M-Pesa. Null when the
 * amount cannot be written as a money figure, so a bad figure is never sent.
 */
export function paymentBody(input: { customerId: string; cents: number; channel: PaymentChannel; reference: string }): PaymentBody | null {
  const amount = centsToAmount(input.cents);
  if (amount === null || amount <= 0 || input.customerId.trim() === '') return null;
  const reference = input.channel === 'mpesa' ? cleanDisplayText(input.reference, 128) : '';
  return {
    customerId: input.customerId.trim(),
    amount,
    channel: input.channel,
    ...(reference ? { reference } : {}),
  };
}

/**
 * What the server said about a payment it accepted (201). The payment is recorded whatever the body holds, so a body
 * that cannot be read is not a failure: it only leaves the new balance unknown.
 */
export function readPaymentAnswer(raw: unknown): { claimId: string | null; balanceCents: number | null } {
  if (!raw || typeof raw !== 'object') return { claimId: null, balanceCents: null };
  const row = raw as Record<string, unknown>;
  const claim = typeof row.claimId === 'string' ? row.claimId.trim() : '';
  return { claimId: claim || null, balanceCents: signedCents(row.balanceOwed) };
}

/** What a customer owes, from `GET /api/v1/customers/{id}` (`credit.balanceOwed`). Null when it is not there or not a figure. */
export function readBalance(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const credit = (raw as { credit?: unknown }).credit;
  if (!credit || typeof credit !== 'object') return null;
  const cents = signedCents((credit as { balanceOwed?: unknown }).balanceOwed);
  return cents === null || cents < 0 ? null : cents;
}

export type PaymentVerdict = 'went_through' | 'not_seen' | 'changed' | 'unknown';

/**
 * What became of a payment that got no answer, from the balance read again. A balance that is the old one less the
 * payment means it was recorded; the old one unchanged means it was not seen (the server may still be working on it,
 * so the owner decides, and the app does not send it again by itself); anything else means the tab moved for another
 * reason (someone else was paid or a sale was put on credit), and only the owner can say what that was.
 */
export function paymentVerdict(input: { owedBeforeCents: number; paidCents: number; owedNowCents: number | null }): PaymentVerdict {
  if (input.owedNowCents === null) return 'unknown';
  if (input.owedNowCents === input.owedBeforeCents - input.paidCents) return 'went_through';
  if (input.owedNowCents === input.owedBeforeCents) return 'not_seen';
  return 'changed';
}

/**
 * What to tell the owner about a payment that got no answer, from what reading the balance again found. The words say
 * what is known and what is not, and none of them tells the person to send the payment again before they have looked.
 */
export function verdictWords(verdict: PaymentVerdict, input: { paidCents: number; owedNowCents: number | null }): { tone: 'ok' | 'warn'; words: string } {
  const paid = kesOrDash(input.paidCents);
  const owedNow = kesOrDash(input.owedNowCents);
  switch (verdict) {
    case 'went_through':
      return { tone: 'ok', words: `Recorded: ${paid} paid. They now owe ${owedNow}.` };
    case 'not_seen':
      return {
        tone: 'warn',
        words: `The payment of ${paid} does not show on the tab yet. The server may still be working on it, so check again in a minute. Only enter it again once you are sure it is not there, or the customer is credited twice.`,
      };
    case 'changed':
      return {
        tone: 'warn',
        words: `The tab is now ${owedNow}, which is not what this payment would leave. Another payment or a sale on credit may have come in. Look at the tab on the web before recording anything more.`,
      };
    default:
      return {
        tone: 'warn',
        words: `Could not check whether the payment of ${paid} was recorded. Check again when the signal is back, or look at the tab on the web. Do not enter it twice.`,
      };
  }
}

export type DoubtAction = { key: 'check' | 'carry_on'; label: string };

/**
 * What the owner may do about a payment that got no answer, from what the last look at the tab found. Looking again is
 * always there. Letting go of the warning is only offered once the tab has actually been seen: with the balance unread
 * nothing has been checked, so "I checked" would not be true and the form would open on a payment that may be there.
 */
export function doubtActions(verdict: PaymentVerdict): DoubtAction[] {
  const check: DoubtAction = { key: 'check', label: 'Check again' };
  switch (verdict) {
    case 'not_seen':
      return [check, { key: 'carry_on', label: 'I checked. It is not there' }];
    case 'changed':
      return [check, { key: 'carry_on', label: 'I have looked. Carry on' }];
    default:
      return [check];
  }
}

/** What to ask before a payment is recorded. The phone cannot take it back, and the server may text the customer about it. */
export function confirmPaymentWords(input: { name: string; paidCents: number; channel: PaymentChannel; owedAfterCents: number }): { title: string; message: string } {
  const how = input.channel === 'cash' ? 'in cash' : 'by M-Pesa';
  return {
    title: 'Record this payment?',
    message: `${input.name} paid ${kesOrDash(input.paidCents)} ${how}. They will owe ${kesOrDash(input.owedAfterCents)} after this. The customer may get a text message about it. The phone cannot take a payment back.`,
  };
}

export type PaymentFailure = { kind: 'refused'; words: string } | { kind: 'doubt' };

/**
 * Whether a payment that failed was turned down (so nothing happened and the person is told why) or may have been
 * applied (so nothing is sent again until the balance has been looked at). The status decides, never the English.
 */
export function describePaymentFailure(error: unknown): PaymentFailure {
  const failure = classifyWrite(error);
  if (failure.kind === 'doubt') return { kind: 'doubt' };
  if (isApiError(error) && error.status === 403) {
    return { kind: 'refused', words: 'Your role is not allowed to record payments. Ask the owner of the shop to allow it.' };
  }
  if (isApiError(error) && error.status === 404) {
    return { kind: 'refused', words: 'That customer is no longer on the list. Go back and open the list again.' };
  }
  return { kind: 'refused', words: failure.words };
}

/**
 * The first word of a customer's name, when it reads as a name. A name is typed by whoever opened the account, and the
 * reminder is sent in the shop's name, so a word that could be a link, a number or a command is not repeated in it.
 * Null when there is no such word.
 */
export function firstNameOf(name: string): string | null {
  const first = cleanDisplayText(name, 60).split(' ')[0] ?? '';
  if (first.length === 0 || first.length > 30) return null;
  if (/[\d/\\:@<>[\](){}#?&=%*_~|^$+;,"`!\u0000-\u001f]/.test(first)) return null;
  if (/\.(?!$)/.test(first)) return null;
  return /[A-Za-z\u00C0-\uFFFF]/.test(first) ? first : null;
}

/** A friendly reminder for a customer, ready to send: first name, what is owed and who from. */
export function reminderText(input: { shop: string; name: string; owedCents: number }): string {
  const first = firstNameOf(input.name) ?? 'there';
  const shop = cleanDisplayText(input.shop, 60) || 'the shop';
  return `Hello ${first}, a friendly reminder from ${shop}: your tab is ${kesOrDash(input.owedCents)}. Please settle when you can. Thank you.`;
}
