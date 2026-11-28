import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '@kiosk/core';
import {
  awaitingCount,
  confirmWords,
  describeStepFailure,
  groupOrders,
  isOpen,
  nextStep,
  orderState,
  normalizeInstant,
  orderTotalWords,
  parseInstant,
  placedWords,
  readOrders,
  stepDoneWords,
  type OwnerOrder,
} from '../src/lib/orders';

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'o-1',
    orderCode: 'ab12cd',
    channel: 'storefront',
    status: 'paid',
    fulfillmentStatus: 'awaiting_confirmation',
    grandTotal: '1250.00',
    currency: 'kes',
    customerName: 'Wanjiku',
    customerPhone: '0712 345 678',
    catalogBranchName: 'Main',
    createdAt: '2026-11-24T05:00:00Z',
    ...over,
  };
}

function order(over: Partial<OwnerOrder> = {}): OwnerOrder {
  return {
    id: 'o-1',
    code: 'AB12CD',
    status: 'paid',
    fulfilment: 'awaiting_confirmation',
    totalCents: 125_000,
    currency: 'KES',
    customer: 'Wanjiku',
    phone: '0712345678',
    branch: 'Main',
    placedAt: 1_000,
    ...over,
  };
}

const fail = (status: number, extra: { foreign?: boolean; hint?: string } = {}, message = 'x') => new ApiError(message, { status, ...extra });

test('the orders in a Spring page, or in a bare list, are read; anything else is a failed read', () => {
  assert.equal(readOrders({ content: [row()], totalElements: 1 })?.length, 1);
  assert.equal(readOrders([row(), row({ id: 'o-2' })])?.length, 2);
  assert.deepEqual(readOrders({ content: [] }), []);
  assert.deepEqual(readOrders([]), []);
  for (const bad of [null, undefined, 'x', 5, {}, { orders: [row()] }, { content: 'x' }, { content: {} }]) assert.equal(readOrders(bad), null, JSON.stringify(bad));
});

test('one order is read with its words cleaned, its money in cents and its phone ready to dial', () => {
  const [read] = readOrders([row()]) ?? [];
  assert.deepEqual(read, {
    id: 'o-1',
    code: 'AB12CD',
    status: 'paid',
    fulfilment: 'awaiting_confirmation',
    totalCents: 125_000,
    currency: 'KES',
    customer: 'Wanjiku',
    phone: '0712345678',
    branch: 'Main',
    placedAt: Date.parse('2026-11-24T05:00:00Z'),
  });
});

test('what the server did not say is left out and never made up', () => {
  const [read] = readOrders([{ id: 'abcd-efgh-1234-5678' }]) ?? [];
  assert.equal(read?.code, '12345678'.toUpperCase());
  assert.equal(read?.status, '');
  assert.equal(read?.fulfilment, '');
  assert.equal(read?.totalCents, null);
  assert.equal(read?.currency, 'KES');
  assert.equal(read?.customer, 'Customer');
  assert.equal(read?.phone, null);
  assert.equal(read?.branch, null);
  assert.equal(read?.placedAt, null);
});

test('a code that is not one word is replaced by the end of the id, and a phone that is not a number is dropped', () => {
  const [read] = readOrders([row({ id: 'aaaa-bbbb-cccc-dddd', orderCode: 'two words', customerPhone: 'ask at the desk', createdAt: 'yesterday' })]) ?? [];
  assert.equal(read?.code, 'CCCCDDDD');
  assert.equal(read?.phone, null);
  assert.equal(read?.placedAt, null);
  assert.equal(readOrders([row({ orderCode: 'x'.repeat(25) })])?.[0]?.code, 'O-1'.replace('-', '').toUpperCase());
});

test('a status is read in lower case, and a paid order with no step is waiting to be confirmed', () => {
  const [paid] = readOrders([row({ status: ' PAID ', fulfillmentStatus: null })]) ?? [];
  assert.equal(paid?.status, 'paid');
  assert.equal(paid?.fulfilment, 'awaiting_confirmation');
  const [unpaid] = readOrders([row({ status: 'pending_payment', fulfillmentStatus: null })]) ?? [];
  assert.equal(unpaid?.fulfilment, '');
  const [stated] = readOrders([row({ fulfillmentStatus: 'DISPATCHED' })]) ?? [];
  assert.equal(stated?.fulfilment, 'dispatched');
});

test('rows that are not orders are left out, and an order is listed once', () => {
  const read = readOrders([row(), row(), null, 'x', 5, {}, { id: '' }, { id: '   ' }, { id: 'x'.repeat(65) }, [], row({ id: 'o-2' })]) ?? [];
  assert.deepEqual(read.map((o) => o.id), ['o-1', 'o-2']);
});

test('no more than the first two hundred rows are read', () => {
  const rows = Array.from({ length: 250 }, (_, i) => row({ id: `o-${i}` }));
  assert.equal(readOrders(rows)?.length, 200);
});

test('an order is open until it is finished, cancelled or its payment failed', () => {
  assert.equal(isOpen({ status: 'paid', fulfilment: 'confirmed' }), true);
  assert.equal(isOpen({ status: 'pending_payment', fulfilment: '' }), true);
  assert.equal(isOpen({ status: 'paid', fulfilment: 'completed' }), false);
  assert.equal(isOpen({ status: 'paid', fulfilment: 'cancelled' }), false);
  assert.equal(isOpen({ status: 'cancelled', fulfilment: 'cancelled' }), false);
  assert.equal(isOpen({ status: 'payment_failed', fulfilment: '' }), false);
});

test('the one step an order can take next, and no step for an order that cannot move', () => {
  assert.deepEqual(nextStep({ status: 'paid', fulfilment: 'awaiting_confirmation' }), { to: 'confirmed', label: 'Confirm' });
  assert.deepEqual(nextStep({ status: 'paid', fulfilment: 'confirmed' }), { to: 'dispatched', label: 'Ready' });
  assert.deepEqual(nextStep({ status: 'paid', fulfilment: 'dispatched' }), { to: 'completed', label: 'Handed over' });
  assert.equal(nextStep({ status: 'paid', fulfilment: 'completed' }), null);
  assert.equal(nextStep({ status: 'paid', fulfilment: 'cancelled' }), null);
  assert.equal(nextStep({ status: 'paid', fulfilment: 'something_new' }), null);
  assert.equal(nextStep({ status: 'paid', fulfilment: '' }), null);
  assert.equal(nextStep({ status: 'pending_payment', fulfilment: 'awaiting_confirmation' }), null);
  assert.equal(nextStep({ status: 'payment_failed', fulfilment: 'awaiting_confirmation' }), null);
  assert.equal(nextStep({ status: 'cancelled', fulfilment: 'confirmed' }), null);
  assert.equal(nextStep({ status: '', fulfilment: 'confirmed' }), null);
});

test('every step asks first, names the order, and says it cannot be taken back', () => {
  const steps = [
    { to: 'confirmed', label: 'Confirm' },
    { to: 'dispatched', label: 'Ready' },
    { to: 'completed', label: 'Handed over' },
  ] as const;
  const words = steps.map((step) => confirmWords({ code: 'AB12CD' }, step));
  assert.equal(new Set(words.map((w) => w.title)).size, 3);
  for (const w of words) {
    assert.match(w.title, /AB12CD/);
    assert.match(w.message, /cannot be taken back/);
    // The server messages the customer on every step, the last one included, so each question says so.
    assert.match(w.message, /may be messaged/);
  }
  assert.deepEqual(words.map((w) => w.button), ['Confirm', 'Ready', 'Handed over']);
  assert.match(words[0]?.message ?? '', /confirmed/);
  assert.match(words[1]?.message ?? '', /ready/);
  assert.match(words[2]?.message ?? '', /collected/);
});

test('where an order stands is said in words, and the ones that need the owner are loud', () => {
  const state = (status: string, fulfilment = '') => orderState({ status, fulfilment });
  assert.deepEqual(state('pending_payment'), { label: 'Waiting for payment', tone: 'warn' });
  assert.deepEqual(state('payment_failed'), { label: 'Payment failed', tone: 'bad' });
  assert.deepEqual(state('cancelled', 'cancelled'), { label: 'Cancelled', tone: 'quiet' });
  assert.deepEqual(state('paid', 'awaiting_confirmation'), { label: 'Paid, waiting for you', tone: 'ask' });
  assert.deepEqual(state('paid', 'confirmed'), { label: 'Packing', tone: 'ok' });
  assert.deepEqual(state('paid', 'dispatched'), { label: 'Ready', tone: 'ok' });
  assert.deepEqual(state('paid', 'completed'), { label: 'Done', tone: 'quiet' });
  assert.deepEqual(state('paid', 'cancelled'), { label: 'Cancelled', tone: 'quiet' });
  assert.deepEqual(state('paid', 'something_new'), { label: 'Paid', tone: 'ok' });
  assert.deepEqual(state('something_new'), { label: 'Not known', tone: 'quiet' });
});

test('only a paid order that has not been confirmed is waiting for the owner', () => {
  const orders = [
    order({ id: 'a' }),
    order({ id: 'b', fulfilment: 'confirmed' }),
    order({ id: 'c', status: 'pending_payment', fulfilment: '' }),
    order({ id: 'd' }),
    order({ id: 'e', status: 'cancelled', fulfilment: 'awaiting_confirmation' }),
  ];
  assert.equal(awaitingCount(orders), 2);
  assert.equal(awaitingCount([]), 0);
});

test('the queue is grouped by what the owner has to do, and a group with nothing in it is left out', () => {
  const groups = groupOrders([
    order({ id: 'finished-1', fulfilment: 'completed', placedAt: 10 }),
    order({ id: 'unpaid-1', status: 'pending_payment', fulfilment: '', placedAt: 20 }),
    order({ id: 'confirm-1', placedAt: 30 }),
    order({ id: 'packing-1', fulfilment: 'confirmed', placedAt: 40 }),
    order({ id: 'failed-1', status: 'payment_failed', fulfilment: '', placedAt: 50 }),
    order({ id: 'odd-1', status: 'something_new', fulfilment: '', placedAt: 60 }),
  ]);
  assert.deepEqual(groups.map((g) => g.key), ['confirm', 'under_way', 'unpaid', 'finished']);
  assert.deepEqual(groups.map((g) => g.title), ['Waiting for you', 'Being handled', 'Waiting for payment', 'Finished']);
  assert.deepEqual(groups[0]?.orders.map((o) => o.id), ['confirm-1']);
  assert.deepEqual(groups[1]?.orders.map((o) => o.id), ['packing-1']);
  assert.deepEqual(groups[2]?.orders.map((o) => o.id), ['unpaid-1']);
  assert.deepEqual(groups[3]?.orders.map((o) => o.id), ['odd-1', 'failed-1', 'finished-1']);
  assert.deepEqual(groupOrders([]), []);
  assert.deepEqual(groupOrders([order({ id: 'x', fulfilment: 'confirmed' })]).map((g) => g.key), ['under_way']);
});

test('the order that has waited longest comes first among those waiting, and the newest first everywhere else', () => {
  const groups = groupOrders([
    order({ id: 'w-new', placedAt: 300 }),
    order({ id: 'w-old', placedAt: 100 }),
    order({ id: 'w-unknown', placedAt: null }),
    order({ id: 'w-mid', placedAt: 200 }),
    order({ id: 'p-old', fulfilment: 'confirmed', placedAt: 100 }),
    order({ id: 'p-new', fulfilment: 'dispatched', placedAt: 300 }),
    order({ id: 'p-unknown', fulfilment: 'confirmed', placedAt: null }),
  ]);
  assert.deepEqual(groups[0]?.orders.map((o) => o.id), ['w-old', 'w-mid', 'w-new', 'w-unknown']);
  assert.deepEqual(groups[1]?.orders.map((o) => o.id), ['p-new', 'p-old', 'p-unknown']);
});

test('orders with the same time keep a steady order, and only the last ten finished ones are shown', () => {
  const same = groupOrders([order({ id: 'b', placedAt: 5 }), order({ id: 'a', placedAt: 5 }), order({ id: 'c', placedAt: 5 })]);
  assert.deepEqual(same[0]?.orders.map((o) => o.id), ['a', 'b', 'c']);
  const done = Array.from({ length: 14 }, (_, i) => order({ id: `d-${String(i).padStart(2, '0')}`, fulfilment: 'completed', placedAt: i }));
  const finished = groupOrders(done)[0];
  assert.equal(finished?.orders.length, 10);
  assert.equal(finished?.orders[0]?.id, 'd-13');
  assert.equal(finished?.orders[9]?.id, 'd-04');
});

test('a total is said with its currency, or the currency alone when it is not known', () => {
  assert.equal(orderTotalWords({ totalCents: 125_050, currency: 'KES' }), 'KES 1,250.50');
  assert.equal(orderTotalWords({ totalCents: 0, currency: 'KES' }), 'KES 0.00');
  assert.equal(orderTotalWords({ totalCents: null, currency: 'USD' }), 'USD');
});

test('how long ago an order was placed is said in the nearest unit', () => {
  const at = (minutesAgo: number) => placedWords({ placedAt: 10_000_000 - minutesAgo * 60_000 }, 10_000_000);
  assert.equal(at(0), 'just now');
  assert.equal(at(1), '1 min ago');
  assert.equal(at(59), '59 min ago');
  assert.equal(at(60), '1 h ago');
  assert.equal(at(23 * 60 + 59), '23 h ago');
  assert.equal(at(24 * 60), '1 d ago');
  assert.equal(at(3 * 24 * 60), '3 d ago');
  assert.equal(placedWords({ placedAt: null }, 5), '');
  assert.equal(placedWords({ placedAt: 20_000_000 }, 10_000_000), 'just now');
});

test('a step that did not go through is explained by what the server said, and the list is looked at again', () => {
  const said = (error: unknown) => describeStepFailure(error);
  assert.deepEqual(said(fail(409)), { reload: true, words: 'This order has already moved on, or is not paid yet. The list has been refreshed.' });
  assert.deepEqual(said(fail(404)), { reload: true, words: 'This order is no longer there. The list has been refreshed.' });
  assert.deepEqual(said(fail(403)), { reload: false, words: 'Your role is not allowed to update web orders.' });
  assert.deepEqual(said(fail(422, { hint: 'Fulfillment updates require a paid order' })), { reload: false, words: 'The server said no: Fulfillment updates require a paid order' });
  assert.deepEqual(said(fail(400, {}, 'Bad status')), { reload: false, words: 'The server said no: Bad status' });
  const unclear = /Could not tell whether the step went through/;
  assert.match(said(fail(500)).words, unclear);
  assert.equal(said(fail(500)).reload, true);
  assert.match(said(new Error('offline')).words, unclear);
  assert.match(said(fail(409, { foreign: true })).words, unclear);
  assert.match(said(fail(422, {}, '')).words, unclear);
});

test('what the server said is cut to a short line', () => {
  const words = describeStepFailure(fail(422, { hint: 'y'.repeat(500) })).words;
  assert.equal(words.length, 'The server said no: '.length + 120);
});

test('an order id may be as long as sixty-four characters and no longer', () => {
  assert.equal(readOrders([row({ id: 'x'.repeat(64) })])?.length, 1);
  assert.equal(readOrders([row({ id: 'x'.repeat(65) })])?.length, 0);
});

test('an instant with six or nine digits of a second is read, so an order keeps its age and its place in the queue', () => {
  const at = Date.UTC(2026, 10, 24, 5, 0, 0, 123);
  assert.equal(parseInstant('2026-11-24T05:00:00.123Z'), at);
  assert.equal(parseInstant('2026-11-24T05:00:00.123456Z'), at);
  assert.equal(parseInstant('2026-11-24T05:00:00.123456789Z'), at);
  assert.equal(parseInstant('2026-11-24T08:00:00.123456+03:00'), at);
  assert.equal(parseInstant('2026-11-24T05:00:00.5Z'), Date.UTC(2026, 10, 24, 5, 0, 0, 500));
  assert.equal(parseInstant('2026-11-24T05:00:00Z'), Date.UTC(2026, 10, 24, 5, 0, 0, 0));
  assert.equal(parseInstant(' 2026-11-24T05:00:00.000000Z '), Date.UTC(2026, 10, 24, 5, 0, 0, 0));
  for (const bad of ['', 'yesterday', '1.5 apples', '2026-13-45T99:99:99.123456Z']) assert.equal(parseInstant(bad), null, bad);
});

test('the fraction of a second is cut or padded to three digits before a date reader sees it', () => {
  assert.equal(normalizeInstant('2026-11-24T05:00:00.123456Z'), '2026-11-24T05:00:00.123Z');
  assert.equal(normalizeInstant('2026-11-24T05:00:00.123456789+03:00'), '2026-11-24T05:00:00.123+03:00');
  assert.equal(normalizeInstant('2026-11-24T05:00:00.5Z'), '2026-11-24T05:00:00.500Z');
  assert.equal(normalizeInstant('2026-11-24T05:00:00.12Z'), '2026-11-24T05:00:00.120Z');
  assert.equal(normalizeInstant('2026-11-24T05:00:00.123Z'), '2026-11-24T05:00:00.123Z');
  assert.equal(normalizeInstant(' 2026-11-24T05:00:00Z '), '2026-11-24T05:00:00Z');
});

test('an order placed with a long fraction of a second still has a time on a date reader that takes only three digits', () => {
  // Node reads any number of digits; a phone's reader may not. This one refuses more than three, as the strictest would.
  const real = Date.parse;
  Date.parse = (text: string) => (/\.\d{4,}/.test(text) ? Number.NaN : real(text));
  try {
    const [order] = readOrders([row({ createdAt: '2026-11-24T05:00:00.123456Z' })]) as OwnerOrder[];
    assert.equal(order?.placedAt, Date.UTC(2026, 10, 24, 5, 0, 0, 123));
    assert.equal(parseInstant('2026-11-24T05:00:00.123456789Z'), Date.UTC(2026, 10, 24, 5, 0, 0, 123));
  } finally {
    Date.parse = real;
  }
});

test('each step has its own words when it is done, and marking ready warns that a delivery may be booked', () => {
  assert.equal(stepDoneWords({ code: 'AB12CD' }, { to: 'confirmed' }), 'AB12CD confirmed.');
  assert.equal(stepDoneWords({ code: 'AB12CD' }, { to: 'dispatched' }), 'AB12CD marked ready.');
  assert.equal(stepDoneWords({ code: 'AB12CD' }, { to: 'completed' }), 'AB12CD handed over.');
  const ready = confirmWords({ code: 'AB12CD' }, { to: 'dispatched', label: 'Ready' });
  assert.match(ready.message, /messaged that their order is ready, and a delivery parcel may be booked/);
  assert.match(ready.message, /cannot be taken back/);
});
