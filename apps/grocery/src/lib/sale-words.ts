import { formatKes, formatQty } from '@kiosk/core';
import { basketTotalCents, type BasketLine } from './basket';
import { forwardWords, type ForwardEntry } from './forward';
import type { ForwardReport } from './forward-sender';
import { expiryWords, type GroceryInvoice } from './invoices';

export type Tone = 'normal' | 'warn' | 'danger' | 'ok';

/** "2 × KES 199.00" for things sold one by one, "1.25 kg × KES 120.00" for things sold by weight. */
export function lineSummary(line: BasketLine): string {
  const quantity = formatQty(line.quantityUnits);
  return `${line.weighed ? `${quantity} ${line.unitName}` : quantity} × ${formatKes(line.unitCents)}`;
}

/** "3 items · KES 1,250.50", or "Nothing in the basket". */
export function basketHeadline(basket: { lines: readonly BasketLine[] }): string {
  const count = basket.lines.length;
  if (count === 0) return 'Nothing in the basket';
  return `${count} ${count === 1 ? 'item' : 'items'} · ${formatKes(basketTotalCents(basket))}`;
}

/** "KES 1,250.00 · 3 items": what a sale comes to. A sent sale shows the total the server made. */
export function saleHeadline(entry: ForwardEntry): string {
  const total = entry.result && entry.result.totalCents !== null ? entry.result.totalCents : entry.totalCents;
  return `${formatKes(total)} · ${entry.itemCount} ${entry.itemCount === 1 ? 'item' : 'items'}`;
}

/** Where a sale stands, in words for the person, and how loudly to say it. */
export function saleStatus(entry: ForwardEntry, now: number): { tone: Tone; words: string } {
  switch (forwardWords(entry, now)) {
    case 'sent': {
      const where = entry.result ? `counter ${entry.result.counterNumber}` : '';
      const code = entry.result && entry.result.code ? ` · code ${entry.result.code}` : '';
      return { tone: 'ok', words: `Sent to the cashier${where ? `: ${where}` : ''}${code}` };
    }
    case 'waiting':
      return { tone: 'warn', words: 'Waiting for a signal. It is sent on its own.' };
    case 'stale':
      return { tone: 'warn', words: 'Waiting for a long time. It is still sent when there is a signal, but prices may have changed.' };
    case 'in_doubt':
      return { tone: 'warn', words: 'Sent, but no answer came back. It may already be at the cashier. Look in Invoices before sending it again.' };
    case 'refused':
      return { tone: 'danger', words: entry.problem ? entry.problem.words : 'The server did not accept this sale.' };
  }
}

export type QueueSummary = { waiting: number; inDoubt: number; refused: number };

/** How many of a person's sales are waiting, may or may not have arrived, or were turned down. Sent ones are not counted. */
export function queueSummary(entries: readonly ForwardEntry[], now: number): QueueSummary {
  const summary: QueueSummary = { waiting: 0, inDoubt: 0, refused: 0 };
  for (const entry of entries) {
    const words = forwardWords(entry, now);
    if (words === 'waiting' || words === 'stale') summary.waiting += 1;
    else if (words === 'in_doubt') summary.inDoubt += 1;
    else if (words === 'refused') summary.refused += 1;
  }
  return summary;
}

function sales(count: number): string {
  return `${count} ${count === 1 ? 'sale' : 'sales'}`;
}

/** The messages to show above the counter for sales that are not done yet, the worst first. Empty when everything has arrived. */
export function queueNotes(summary: QueueSummary): Array<{ tone: 'warn' | 'danger'; text: string }> {
  const notes: Array<{ tone: 'warn' | 'danger'; text: string }> = [];
  if (summary.refused > 0) notes.push({ tone: 'danger', text: `${sales(summary.refused)} the server did not accept. Open Sales to fix ${summary.refused === 1 ? 'it' : 'them'}.` });
  if (summary.inDoubt > 0) notes.push({ tone: 'warn', text: `${sales(summary.inDoubt)} may or may not have reached the cashier. Look in Invoices before sending again.` });
  if (summary.waiting > 0) notes.push({ tone: 'warn', text: `${sales(summary.waiting)} waiting to be sent. ${summary.waiting === 1 ? 'It goes on its own' : 'They go on their own'} when there is a signal.` });
  return notes;
}

/** How long after a sale is sent its result is still shown above the counter. */
export const LAST_SALE_WINDOW_MS = 15 * 60_000;

/** The most recent sale that reached the cashier within the last quarter hour, so the code can be read out. */
export function lastSentSale(entries: readonly ForwardEntry[], now: number): ForwardEntry | null {
  let best: ForwardEntry | null = null;
  for (const entry of entries) {
    if (!entry.result || entry.sentAt === null || now - entry.sentAt > LAST_SALE_WINDOW_MS) continue;
    if (!best || entry.sentAt > (best.sentAt ?? 0)) best = entry;
  }
  return best;
}

export type Say = { tone: 'info' | 'ok' | 'warn' | 'danger'; text: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayStart(ms: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "14:05" today, "Yesterday 14:05", or "21 Nov 14:05", on this phone's clock. Empty when there is no moment. */
export function whenWords(ms: number | null, now: number): string {
  if (ms === null || !Number.isFinite(ms)) return '';
  const time = clockTime(ms);
  const days = Math.round((dayStart(now) - dayStart(ms)) / 86_400_000);
  if (days === 0) return time;
  if (days === 1) return `Yesterday ${time}`;
  const date = new Date(ms);
  return `${date.getDate()} ${MONTHS[date.getMonth()] ?? ''} ${time}`;
}

/** An invoice's first line in a list: the code the cashier reads, and what it comes to. */
export function invoiceTitle(invoice: GroceryInvoice): string {
  const code = invoice.code ?? 'No code';
  return invoice.totalCents === null ? code : `${code} · ${formatKes(invoice.totalCents)}`;
}

/** Its second line: how many items, who made it, when, how long it has left, and who has it open at the till. */
export function invoiceSubtitle(invoice: GroceryInvoice, now: number): string {
  return [
    invoice.lineCount > 0 ? `${invoice.lineCount} ${invoice.lineCount === 1 ? 'item' : 'items'}` : null,
    invoice.createdByName,
    whenWords(invoice.createdAt, now) || null,
    expiryWords(invoice, now),
    invoice.lockedByName ? `open at the till with ${invoice.lockedByName}` : null,
  ]
    .filter((part): part is string => !!part)
    .join(' · ');
}

/** How loudly an invoice's state is said: waiting for payment stands out, paid is good, the rest is history. */
export function invoiceTone(invoice: GroceryInvoice): Tone {
  if (invoice.state === 'pending_payment') return 'warn';
  return invoice.state === 'paid' ? 'ok' : 'normal';
}

/** One word for the right edge of a sale's row in the list. */
export function saleTag(entry: ForwardEntry, now: number): string {
  switch (forwardWords(entry, now)) {
    case 'sent':
      return 'Sent';
    case 'waiting':
    case 'stale':
      return 'Waiting';
    case 'in_doubt':
      return 'Check';
    case 'refused':
      return 'Not sent';
  }
}

/** What a round of sending came to, said to the person who asked for it. */
export function reportWords(report: ForwardReport): Say {
  const rest = report.stopped ? ' The rest are waiting for a signal.' : '';
  if (report.sent > 0) {
    const refused = report.refused > 0 ? ` ${sales(report.refused)} not accepted.` : '';
    return { tone: report.refused > 0 ? 'warn' : 'ok', text: `${sales(report.sent)} sent to the cashier.${refused}${rest}` };
  }
  if (report.refused > 0) return { tone: 'danger', text: `${sales(report.refused)} not accepted by the server.${rest}` };
  if (report.stopped) return { tone: 'warn', text: 'Could not reach the server. Sales stay on this phone and go when there is a signal.' };
  return { tone: 'info', text: 'Nothing was waiting to be sent.' };
}

/** "14:05", on this phone's clock. Empty when there is no moment. */
export function clockTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '';
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * What a person is asked before a sale is thrown away. A sale the server may already have is looked for first, whether
 * or not the server also said no to it: the phone could not read the answer, or it was mixed into another sale.
 */
export function discardWords(entry: ForwardEntry): { doubtful: boolean; title: string; message: string } {
  if (entry.inDoubt && !entry.result) {
    return {
      doubtful: true,
      title: 'It may already be at the cashier',
      message: entry.problem
        ? `The server may already have this sale. ${entry.problem.words}`
        : 'The phone sent this sale but never heard back. Look in Invoices before throwing it away: if it is there, the cashier can serve it.',
    };
  }
  return { doubtful: false, title: 'Throw this sale away?', message: 'It has not been sent, and its items are not put back in the basket.' };
}

/** What a person is told before signing out with sales waiting or items in the basket, or null when there is nothing to say. */
export function signOutWords(waiting: number, basketLines: number): string | null {
  if (waiting <= 0 && basketLines <= 0) return null;
  const said: string[] = [];
  if (waiting > 0) said.push(`${waiting} ${waiting === 1 ? 'sale is' : 'sales are'} waiting to be sent. ${waiting === 1 ? 'It stays' : 'They stay'} on this phone, for you, until you sign in here again.`);
  if (basketLines > 0) said.push(`The basket has ${basketLines} ${basketLines === 1 ? 'item' : 'items'} in it. It stays only until someone else starts a sale on this phone, or a day goes by.`);
  return said.join(' ');
}
