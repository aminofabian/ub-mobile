import assert from 'node:assert/strict';
import test from 'node:test';
import type { BasketLine } from '../src/lib/basket';
import { STALE_AFTER_MS, type ForwardEntry, type ForwardResult } from '../src/lib/forward';
import type { GroceryInvoice } from '../src/lib/invoices';
import {
  basketHeadline,
  clockTime,
  discardWords,
  invoiceSubtitle,
  invoiceTitle,
  invoiceTone,
  LAST_SALE_WINDOW_MS,
  lastSentSale,
  lineSummary,
  queueNotes,
  queueSummary,
  reportWords,
  saleHeadline,
  saleStatus,
  saleTag,
  signOutWords,
  whenWords,
} from '../src/lib/sale-words';

const NOW = 1_000_000_000_000;

function entry(over: Partial<ForwardEntry> = {}): ForwardEntry {
  return {
    id: 'a',
    issueKey: 'k',
    ownerId: 'u1',
    branchId: 'b1',
    createdAt: NOW - 60_000,
    fromBasket: 1,
    lines: [],
    itemCount: 3,
    totalCents: 125050,
    draftId: null,
    sentAt: null,
    inDoubt: false,
    problem: null,
    result: null,
    ...over,
  };
}

function sent(over: Partial<ForwardResult> = {}, at = NOW - 1000, extra: Partial<ForwardEntry> = {}): ForwardEntry {
  return entry({ sentAt: at, result: { draftId: 'd', invoiceId: 'i', counterNumber: 7, code: '482913', totalCents: 125050, status: 'pending_payment', ...over }, ...extra });
}

test('a sale is headed by what it comes to and how many items it has', () => {
  assert.equal(saleHeadline(entry()), 'KES 1,250.50 · 3 items');
  assert.equal(saleHeadline(entry({ itemCount: 1 })), 'KES 1,250.50 · 1 item');
});

test('a sent sale shows the total the server made, not the phone\'s', () => {
  assert.equal(saleHeadline(sent({ totalCents: 125100 })), 'KES 1,251.00 · 3 items');
  assert.equal(saleHeadline(sent({ totalCents: null })), 'KES 1,250.50 · 3 items');
});

test('where a sale stands, in words and in how loudly they are said', () => {
  assert.deepEqual(saleStatus(entry(), NOW), { tone: 'warn', words: 'Waiting for a signal. It is sent on its own.' });
  assert.equal(saleStatus(entry({ createdAt: NOW - STALE_AFTER_MS - 1 }), NOW).tone, 'warn');
  assert.match(saleStatus(entry({ createdAt: NOW - STALE_AFTER_MS - 1 }), NOW).words, /prices may have changed/);
  assert.match(saleStatus(entry({ inDoubt: true }), NOW).words, /Look in Invoices before sending it again/);
  const refused = saleStatus(entry({ problem: { kind: 'refused', status: 422, words: 'An item is no longer sold.' } }), NOW);
  assert.deepEqual(refused, { tone: 'danger', words: 'An item is no longer sold.' });
});

test('a sent sale says which counter and which code', () => {
  assert.deepEqual(saleStatus(sent(), NOW), { tone: 'ok', words: 'Sent to the cashier: counter 7 · code 482913' });
  assert.deepEqual(saleStatus(sent({ code: null }), NOW), { tone: 'ok', words: 'Sent to the cashier: counter 7' });
});

test('the queue is counted by what each sale needs, and sent sales are not in it', () => {
  const entries = [
    entry({ id: '1' }),
    entry({ id: '2', createdAt: NOW - STALE_AFTER_MS - 1 }),
    entry({ id: '3', inDoubt: true }),
    entry({ id: '4', problem: { kind: 'conflict', status: 409, words: 'x' } }),
    sent({}, NOW, { id: '5' }),
    sent({}, NOW, { id: '6' }),
  ];
  assert.deepEqual(queueSummary(entries, NOW), { waiting: 2, inDoubt: 1, refused: 1 });
  assert.deepEqual(queueSummary([], NOW), { waiting: 0, inDoubt: 0, refused: 0 });
});

test('the worst news comes first, and nothing is said when everything arrived', () => {
  assert.deepEqual(queueNotes({ waiting: 0, inDoubt: 0, refused: 0 }), []);
  const notes = queueNotes({ waiting: 2, inDoubt: 1, refused: 1 });
  assert.deepEqual(notes.map((note) => note.tone), ['danger', 'warn', 'warn']);
  assert.match(notes[0]?.text ?? '', /^1 sale the server did not accept\. Open Sales to fix it\.$/);
  assert.match(notes[1]?.text ?? '', /^1 sale may or may not have reached the cashier/);
  assert.match(notes[2]?.text ?? '', /^2 sales waiting to be sent\. They go on their own/);
  assert.match(queueNotes({ waiting: 1, inDoubt: 0, refused: 0 })[0]?.text ?? '', /^1 sale waiting to be sent\. It goes on its own/);
});

test('the last sale is shown for a quarter of an hour, newest first', () => {
  const old = sent({ code: 'OLD' }, NOW - LAST_SALE_WINDOW_MS - 1, { id: 'old' });
  const earlier = sent({ code: 'EARLIER' }, NOW - 5 * 60_000, { id: 'earlier' });
  const latest = sent({ code: 'LATEST' }, NOW - 60_000, { id: 'latest' });
  assert.equal(lastSentSale([old], NOW), null);
  assert.equal(lastSentSale([earlier, latest, old], NOW)?.id, 'latest');
  assert.equal(lastSentSale([latest, earlier], NOW)?.id, 'latest');
  assert.equal(lastSentSale([entry()], NOW), null);
  assert.equal(lastSentSale([], NOW), null);
  const edge = sent({ code: 'EDGE' }, NOW - LAST_SALE_WINDOW_MS, { id: 'edge' });
  assert.equal(lastSentSale([edge], NOW)?.id, 'edge', 'a quarter of an hour exactly is still shown');
  const asked = entry({ id: 'asked', sentAt: NOW - 1000, inDoubt: true });
  assert.equal(lastSentSale([asked], NOW), null, 'a sale that was asked for but not answered is not a sent one');
});

const SUGAR: BasketLine = { lineId: 'l1', itemId: 'i1', name: 'Sugar', unitName: 'each', weighed: false, quantityUnits: 20_000, unitCents: 19900 };
const TOMATOES: BasketLine = { lineId: 'l2', itemId: 'i2', name: 'Tomatoes', unitName: 'kg', weighed: true, quantityUnits: 12_500, unitCents: 12000 };

test('a line says how many at what price, with the unit for things sold by weight', () => {
  assert.equal(lineSummary(SUGAR), '2 × KES 199.00');
  assert.equal(lineSummary(TOMATOES), '1.25 kg × KES 120.00');
  assert.equal(lineSummary({ ...TOMATOES, quantityUnits: 1_250 }), '0.125 kg × KES 120.00');
});

test('the basket is headed by how many lines it has and what they come to', () => {
  assert.equal(basketHeadline({ lines: [] }), 'Nothing in the basket');
  assert.equal(basketHeadline({ lines: [SUGAR] }), '1 item · KES 398.00');
  // 2 × 199.00 + 1.25 × 120.00 = 398.00 + 150.00
  assert.equal(basketHeadline({ lines: [SUGAR, TOMATOES] }), '2 items · KES 548.00');
});

test('each sale has one short word for the edge of its row', () => {
  assert.equal(saleTag(entry(), NOW), 'Waiting');
  assert.equal(saleTag(entry({ createdAt: NOW - STALE_AFTER_MS - 1 }), NOW), 'Waiting');
  assert.equal(saleTag(entry({ inDoubt: true }), NOW), 'Check');
  assert.equal(saleTag(entry({ problem: { kind: 'refused', status: 422, words: 'x' } }), NOW), 'Not sent');
  assert.equal(saleTag(sent(), NOW), 'Sent');
});

test('a round of sending is told in plain words, and a lack of signal is not told as an error', () => {
  assert.deepEqual(reportWords({ sent: 2, refused: 0, stopped: false }), { tone: 'ok', text: '2 sales sent to the cashier.' });
  assert.deepEqual(reportWords({ sent: 1, refused: 0, stopped: true }), { tone: 'ok', text: '1 sale sent to the cashier. The rest are waiting for a signal.' });
  assert.deepEqual(reportWords({ sent: 1, refused: 2, stopped: false }), { tone: 'warn', text: '1 sale sent to the cashier. 2 sales not accepted.' });
  assert.deepEqual(reportWords({ sent: 0, refused: 1, stopped: false }), { tone: 'danger', text: '1 sale not accepted by the server.' });
  assert.deepEqual(reportWords({ sent: 0, refused: 1, stopped: true }), { tone: 'danger', text: '1 sale not accepted by the server. The rest are waiting for a signal.' });
  assert.deepEqual(reportWords({ sent: 0, refused: 0, stopped: true }), { tone: 'warn', text: 'Could not reach the server. Sales stay on this phone and go when there is a signal.' });
  assert.deepEqual(reportWords({ sent: 0, refused: 0, stopped: false }), { tone: 'info', text: 'Nothing was waiting to be sent.' });
});

function invoice(over: Partial<GroceryInvoice> = {}): GroceryInvoice {
  return {
    id: 'inv1',
    code: '482913',
    state: 'pending_payment',
    totalCents: 125050,
    lineCount: 3,
    createdBy: 'u1',
    createdByName: 'Wanjiru',
    createdAt: NOW - 5 * 60_000,
    expiresAt: NOW + 30 * 60_000,
    lockedByName: null,
    remote: false,
    customerPhone: null,
    ...over,
  };
}

test('a moment is told as the time today, yesterday with its time, or the date', () => {
  const at = (day: number, hour: number, minute: number) => new Date(2026, 10, day, hour, minute).getTime();
  const now = at(23, 16, 30);
  assert.equal(whenWords(at(23, 14, 5), now), '14:05');
  assert.equal(whenWords(at(22, 9, 0), now), 'Yesterday 09:00');
  assert.equal(whenWords(at(21, 18, 45), now), '21 Nov 18:45');
  assert.equal(whenWords(new Date(2026, 9, 3, 7, 5).getTime(), now), '3 Oct 07:05');
  assert.equal(whenWords(null, now), '');
  assert.equal(whenWords(Number.NaN, now), '');
});

test('an invoice in a list says its code and total, then who made it, when, and what is left of it', () => {
  assert.equal(invoiceTitle(invoice()), '482913 · KES 1,250.50');
  assert.equal(invoiceTitle(invoice({ code: null, totalCents: null })), 'No code');
  assert.equal(invoiceTitle(invoice({ totalCents: null })), '482913');
  const subtitle = invoiceSubtitle(invoice({ createdAt: null }), NOW);
  assert.equal(subtitle, '3 items · Wanjiru · Expires in 30 min');
  assert.equal(invoiceSubtitle(invoice({ createdAt: null, lineCount: 1, createdByName: null, expiresAt: null }), NOW), '1 item');
  assert.equal(invoiceSubtitle(invoice({ createdAt: null, lineCount: 0, createdByName: null, expiresAt: null }), NOW), '');
  assert.match(invoiceSubtitle(invoice({ lockedByName: 'Otieno' }), NOW), /open at the till with Otieno$/);
  assert.equal(invoiceSubtitle(invoice({ state: 'paid', createdAt: null }), NOW), '3 items · Wanjiru');
  const noon = new Date(2026, 10, 23, 12, 0).getTime();
  assert.equal(invoiceSubtitle(invoice({ createdAt: noon - 5 * 60_000, expiresAt: noon + 30 * 60_000 }), noon), '3 items · Wanjiru · 11:55 · Expires in 30 min');
});

test('waiting for payment stands out, paid is good, and the rest is history', () => {
  assert.equal(invoiceTone(invoice()), 'warn');
  assert.equal(invoiceTone(invoice({ state: 'paid' })), 'ok');
  assert.equal(invoiceTone(invoice({ state: 'cancelled' })), 'normal');
  assert.equal(invoiceTone(invoice({ state: 'expired' })), 'normal');
  assert.equal(invoiceTone(invoice({ state: 'other' })), 'normal');
});

test('the time of day has two digits for the hour and the minute', () => {
  assert.equal(clockTime(new Date(2026, 10, 23, 14, 5).getTime()), '14:05');
  assert.equal(clockTime(new Date(2026, 10, 23, 0, 0).getTime()), '00:00');
  assert.equal(clockTime(null), '');
  assert.equal(clockTime(Number.NaN), '');
});

test('a sale that was never sent, or was plainly turned down, is thrown away without a warning about the cashier', () => {
  const never = discardWords(entry());
  assert.deepEqual([never.doubtful, never.title], [false, 'Throw this sale away?']);
  assert.match(never.message, /has not been sent/);
  const turnedDown = discardWords(entry({ problem: { kind: 'refused', status: 422, words: 'No.' } }));
  assert.equal(turnedDown.doubtful, false, 'a no from the server changed nothing there');
  assert.equal(discardWords(sent({}, NOW - 1000, { inDoubt: true })).doubtful, false, 'a sent sale is not in doubt');
});

test('a sale the server may already have is looked for first, with or without a no from the server', () => {
  const lost = discardWords(entry({ inDoubt: true, sentAt: NOW - 5000 }));
  assert.deepEqual([lost.doubtful, lost.title], [true, 'It may already be at the cashier']);
  assert.match(lost.message, /never heard back/);
  // Marked refused and still in doubt (the answer could not be read, or the sale was mixed into another one): not an ordinary refusal.
  const words = 'The shop added this sale to another one that was already open at this counter. Look at that open sale before sending this again.';
  const mixed = discardWords(entry({ inDoubt: true, problem: { kind: 'conflict', status: 200, words } }));
  assert.equal(mixed.doubtful, true);
  assert.ok(mixed.message.includes(words), 'the server\'s own reason is said');
  assert.match(mixed.message, /may already have this sale/);
});

test('before signing out, what waits on the phone is said, and the basket is not promised for as long as the sales', () => {
  assert.equal(signOutWords(0, 0), null);
  assert.equal(signOutWords(-1, 0), null);
  assert.equal(signOutWords(1, 0), '1 sale is waiting to be sent. It stays on this phone, for you, until you sign in here again.');
  assert.equal(signOutWords(3, 0), '3 sales are waiting to be sent. They stay on this phone, for you, until you sign in here again.');
  const basket = signOutWords(0, 1);
  assert.equal(basket, 'The basket has 1 item in it. It stays only until someone else starts a sale on this phone, or a day goes by.');
  assert.doesNotMatch(basket ?? '', /until you sign in here again/, 'a basket is not kept for the person the way a sale is');
  const both = signOutWords(2, 4) ?? '';
  assert.match(both, /^2 sales are waiting to be sent\. They stay on this phone, for you, until you sign in here again\. The basket has 4 items in it\./);
});
