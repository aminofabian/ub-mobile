import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import {
  cancelBody,
  cancelFailureWords,
  cancelOutcome,
  cancelOutcomeOf,
  cancelPath,
  canCancel,
  CANCEL_REASONS,
  classifyCancel,
  expiryWords,
  invoicePath,
  invoicesPath,
  MAX_CANCEL_REASON,
  readInstant,
  readInvoices,
  readOneInvoice,
  sortInvoices,
  stateWords,
  type GroceryInvoice,
} from '../src/lib/invoices';

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'inv1',
    barcodeCode: '123456789012',
    status: 'pending_payment',
    grandTotal: 578.75,
    lineCount: 3,
    createdBy: 'u1',
    createdByName: 'Wanjiru',
    createdAt: '2026-11-23T10:15:30Z',
    expiresAt: '2026-11-23T11:15:30Z',
    lockedBy: null,
    lockedByName: null,
    remote: false,
    customerPhone: null,
    ...over,
  };
}

function invoice(over: Partial<GroceryInvoice> = {}): GroceryInvoice {
  const read = readOneInvoice(row());
  assert.ok(read);
  return { ...read, ...over };
}

test('the server\'s list is read into invoices, with money in cents and times in milliseconds', () => {
  const list = readInvoices({ invoices: [row()] });
  assert.deepEqual(list, [
    {
      id: 'inv1',
      code: '123456789012',
      state: 'pending_payment',
      totalCents: 57875,
      lineCount: 3,
      createdBy: 'u1',
      createdByName: 'Wanjiru',
      createdAt: Date.parse('2026-11-23T10:15:30Z'),
      expiresAt: Date.parse('2026-11-23T11:15:30Z'),
      lockedByName: null,
      remote: false,
      customerPhone: null,
    },
  ]);
});

test('a list that is not a list is not "no invoices"', () => {
  assert.equal(readInvoices(null), null);
  assert.equal(readInvoices({}), null);
  assert.equal(readInvoices({ invoices: 'x' }), null);
  assert.equal(readInvoices('x'), null);
  assert.deepEqual(readInvoices({ invoices: [] }), []);
  assert.equal(readInvoices([row()])?.length, 1, 'a bare list is accepted too');
});

test('a row with no id is left out, and an odd row is still shown', () => {
  const list = readInvoices({ invoices: [row({ id: '' }), null, 5, row({ id: 'inv2', status: 'REFUNDED', grandTotal: 'x', createdAt: 'never', barcodeCode: '  ' })] });
  assert.equal(list?.length, 1);
  assert.deepEqual([list?.[0]?.state, list?.[0]?.totalCents, list?.[0]?.createdAt, list?.[0]?.code], ['other', null, null, null]);
});

test('the status is read whatever its case, and a line count falls back to the lines', () => {
  assert.equal(readOneInvoice(row({ status: 'PAID' }))?.state, 'paid');
  assert.equal(readOneInvoice(row({ status: ' Cancelled ' }))?.state, 'cancelled');
  assert.equal(readOneInvoice(row({ status: 'expired' }))?.state, 'expired');
  assert.equal(readOneInvoice(row({ lineCount: undefined, lines: [{}, {}] }))?.lineCount, 2);
  assert.equal(readOneInvoice(row({ lineCount: -1 }))?.lineCount, 0);
  assert.equal(readOneInvoice(row({ remote: 'yes' }))?.remote, false);
});

test('a moment is read from an ISO date, seconds or milliseconds', () => {
  assert.equal(readInstant('2026-11-23T10:15:30Z'), Date.parse('2026-11-23T10:15:30Z'));
  assert.equal(readInstant(1_795_000_000), 1_795_000_000_000);
  assert.equal(readInstant(1_795_000_000.5), 1_795_000_000_500);
  assert.equal(readInstant(1_795_000_000_000), 1_795_000_000_000);
  for (const bad of [null, undefined, '', 'soon', 0, -5, Number.NaN, {}]) assert.equal(readInstant(bad), null, String(bad));
});

test('the paths carry the branch and the status, and an id is escaped', () => {
  assert.equal(invoicesPath('b 1'), '/api/v1/grocery/invoices?branchId=b%201');
  assert.equal(invoicesPath('b1', 'pending_payment'), '/api/v1/grocery/invoices?branchId=b1&status=pending_payment');
  assert.equal(invoicesPath('b1', 'other'), '/api/v1/grocery/invoices?branchId=b1');
  assert.equal(invoicePath('a/b'), '/api/v1/grocery/invoices/a%2Fb');
  assert.equal(cancelPath('a/b'), '/api/v1/grocery/invoices/a%2Fb/cancel');
});

test('newest first, and invoices with no time last', () => {
  const list = [invoice({ id: 'a', createdAt: 100 }), invoice({ id: 'b', createdAt: null }), invoice({ id: 'c', createdAt: 300 })];
  assert.deepEqual(sortInvoices(list).map((entry) => entry.id), ['c', 'a', 'b']);
  assert.deepEqual(list.map((entry) => entry.id), ['a', 'b', 'c'], 'the list given is not changed');
});

test('the time left on a waiting invoice is said in minutes, then hours', () => {
  const at = Date.parse('2026-11-23T10:15:30Z');
  const waiting = (expiresIn: number | null) => invoice({ expiresAt: expiresIn === null ? null : at + expiresIn });
  assert.equal(expiryWords(waiting(12 * 60_000 - 1), at), 'Expires in 12 min');
  assert.equal(expiryWords(waiting(59 * 60_000), at), 'Expires in 59 min');
  assert.equal(expiryWords(waiting(60 * 60_000), at), 'Expires in 1 h');
  assert.equal(expiryWords(waiting(150 * 60_000), at), 'Expires in 3 h');
  assert.equal(expiryWords(waiting(0), at), 'Expired');
  assert.equal(expiryWords(waiting(-5000), at), 'Expired');
  assert.equal(expiryWords(waiting(null), at), null);
  assert.equal(expiryWords(invoice({ state: 'paid' }), at), null);
  assert.equal(stateWords.pending_payment, 'Waiting for payment');
});

test('only a waiting invoice can be cancelled, and only by someone who may', () => {
  const may = { roleKey: 'grocery_clerk', permissions: ['grocery.invoices.cancel', 'grocery.invoices.read'] };
  assert.ok(canCancel(invoice(), may));
  assert.ok(!canCancel(invoice(), { roleKey: 'grocery_clerk', permissions: ['grocery.invoices.read'] }));
  for (const state of ['paid', 'cancelled', 'expired', 'other'] as const) assert.ok(!canCancel(invoice({ state }), may), state);
});

test('a reason is a preset\'s words, or what was typed for "Other", and never empty', () => {
  assert.deepEqual(cancelBody('changed_mind', ''), { reason: 'Customer changed their mind' });
  assert.deepEqual(cancelBody('changed_mind', 'ignored text'), { reason: 'Customer changed their mind' });
  assert.deepEqual(cancelBody('other', '  Customer left   the shop '), { reason: 'Customer left the shop' });
  assert.equal(cancelBody('other', ''), null);
  assert.equal(cancelBody('other', '   '), null);
  assert.equal(cancelBody('nope' as never, 'x'), null);
  assert.ok((cancelBody('other', 'x'.repeat(500))?.reason.length ?? 0) <= MAX_CANCEL_REASON);
  for (const preset of CANCEL_REASONS.filter((candidate) => candidate.key !== 'other')) {
    assert.deepEqual(cancelBody(preset.key, ''), { reason: preset.words });
  }
});

test('what a failed cancel means', () => {
  const failure = (status: number, extra: { foreign?: boolean } = {}) => classifyCancel(new ApiError('x', { status, ...extra }));
  assert.equal(classifyCancel(new TypeError('Network request failed')), 'doubt');
  for (const status of [401, 408, 423, 429, 500, 503]) assert.equal(failure(status), 'doubt', String(status));
  assert.equal(failure(400, { foreign: true }), 'doubt');
  assert.equal(failure(409), 'moved_on');
  assert.equal(failure(404), 'gone');
  assert.equal(failure(403), 'not_allowed');
  assert.equal(failure(400), 'refused');
  assert.equal(failure(422), 'refused');
  assert.equal(failure(302), 'doubt');
  for (const words of Object.values(cancelFailureWords)) assert.ok(words.length > 10);
});

test('after a cancel whose answer was lost, the invoice says what happened', () => {
  assert.equal(cancelOutcome(row({ status: 'cancelled' })), 'cancelled');
  assert.equal(cancelOutcome(row({ status: 'pending_payment' })), 'open');
  assert.equal(cancelOutcome(row({ status: 'paid' })), 'closed');
  assert.equal(cancelOutcome(row({ status: 'expired' })), 'closed');
  assert.equal(cancelOutcome(row({ status: 'weird' })), 'unknown');
  assert.equal(cancelOutcome(null), 'unknown');
  assert.equal(cancelOutcome({}), 'unknown');
});

test('an invoice already read says what a lost cancel came to', () => {
  const invoice = (state: string) => readOneInvoice(row({ status: state }));
  assert.equal(cancelOutcomeOf(invoice('cancelled')), 'cancelled');
  assert.equal(cancelOutcomeOf(invoice('pending_payment')), 'open');
  assert.equal(cancelOutcomeOf(invoice('paid')), 'closed');
  assert.equal(cancelOutcomeOf(invoice('something_new')), 'unknown');
  assert.equal(cancelOutcomeOf(null), 'unknown');
});

test('a moment is read from a date, or from seconds or milliseconds, and from nothing else', () => {
  assert.equal(readInstant(99_999_999_999), 99_999_999_999_000, 'seconds');
  assert.equal(readInstant(100_000_000_000), 100_000_000_000, 'milliseconds from here');
  assert.equal(readInstant(['2026-11-23T10:15:30Z']), null, 'a list is not a date');
  assert.equal(readInstant({}), null);
  assert.equal(readInstant(''), null);
  assert.equal(readInstant(0), null);
  assert.equal(readInstant(-5), null);
  assert.equal(readInstant(Number.NaN), null);
});

test('who made an invoice, and how many lines it has, are read only from the right kind of value', () => {
  assert.equal(readOneInvoice(row({ createdBy: 7 }))?.createdBy, null);
  assert.equal(readOneInvoice(row({ createdBy: '' }))?.createdBy, null);
  assert.equal(readOneInvoice(row({ createdBy: 'u9' }))?.createdBy, 'u9');
  assert.equal(readOneInvoice(row({ lineCount: 0, lines: [{}, {}] }))?.lineCount, 0, 'the count the server gave wins');
  assert.equal(readOneInvoice(row({ lineCount: undefined, lines: [{}, {}] }))?.lineCount, 2);
  assert.equal(readOneInvoice(row({ lineCount: -1, lines: [{}] }))?.lineCount, 1);
  assert.equal(readOneInvoice(row({ lineCount: undefined }))?.lineCount, 0);
});
