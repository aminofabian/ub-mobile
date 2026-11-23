import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import {
  describeAdvanceFailure,
  describeListFailure,
  nextStep,
  openOrdersFor,
  orderTotalWords,
  parseWebOrder,
  parseWebOrders,
  placedWords,
  statusLabel,
  type WebOrder,
} from '../src/lib/web-orders';

const NOW = Date.parse('2026-11-23T12:00:00.000Z');

const ROW = {
  id: '3f2a1b4c-0000-4000-8000-00000000abcd',
  orderCode: 'ab12cd',
  channel: 'WEB',
  status: 'paid',
  fulfillmentStatus: 'awaiting_confirmation',
  grandTotal: 1250.5,
  currency: 'kes',
  customerName: 'Wanjiru Kamau',
  customerPhone: '+254 712 345 678',
  catalogBranchId: 'b-1',
  createdAt: '2026-11-23T11:48:00.000Z',
};

function order(change: Partial<Record<string, unknown>> = {}): WebOrder {
  const parsed = parseWebOrder({ ...ROW, ...change });
  assert.ok(parsed);
  return parsed;
}

test('an order is read from the server row', () => {
  assert.deepEqual(parseWebOrder(ROW), {
    id: ROW.id,
    code: 'AB12CD',
    customer: 'Wanjiru Kamau',
    phone: '+254712345678',
    totalCents: 125050,
    currency: 'KES',
    paid: true,
    open: true,
    fulfillment: 'awaiting_confirmation',
    branchId: 'b-1',
    placedAt: Date.parse('2026-11-23T11:48:00.000Z'),
  });
});

test('what is not an order is not read as one', () => {
  for (const bad of [null, undefined, 'x', 7, [], {}, { id: '' }, { id: 5 }, { id: '   ' }]) {
    assert.equal(parseWebOrder(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(parseWebOrders([ROW, null, 'x', { id: 'a' }]).map((o) => o.id), [ROW.id, 'a']);
});

test('an order the server gave little about still reads, with nothing invented', () => {
  const bare = parseWebOrder({ id: 'abcd-efgh-1234-5678' });
  assert.equal(bare?.code, 'EFGH12345678'.slice(-8));
  assert.equal(bare?.customer, 'Customer');
  assert.equal(bare?.phone, '');
  assert.equal(bare?.totalCents, null);
  assert.equal(bare?.currency, 'KES');
  assert.equal(bare?.paid, false);
  assert.equal(bare?.branchId, null);
  assert.equal(bare?.placedAt, null);
});

test('a code or a phone number that is not plain is not trusted', () => {
  assert.equal(order({ orderCode: 'ab 12' }).code, order({ orderCode: undefined }).code, 'a code with a space falls back');
  assert.equal(order({ orderCode: '<b>x</b>' }).code, order({ orderCode: undefined }).code);
  for (const phone of ['tel:123', '12345', 'call me', '+254 7; rm -rf', '0712345678901234567', '++254712345678', '']) {
    assert.equal(order({ customerPhone: phone }).phone, '', phone);
  }
  assert.equal(order({ customerPhone: '0712 345 678' }).phone, '0712345678');
});

test('a name from a customer is cleaned and cut like any text shown on the till', () => {
  assert.equal(order({ customerName: 'Ann‮evil\n' }).customer, 'Annevil');
  assert.equal(order({ customerName: 'x'.repeat(200) }).customer.length, 60);
  assert.equal(order({ customerName: '   ' }).customer, 'Customer');
});

test('a total is in cents, and one that is not a number or is below zero is not known', () => {
  assert.equal(order({ grandTotal: '99.99' }).totalCents, 9999);
  assert.equal(order({ grandTotal: 0 }).totalCents, 0);
  for (const total of [-5, 'abc', null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(order({ grandTotal: total }).totalCents, null, String(total));
  }
});

test('an order is open until it is done, cancelled or its payment failed', () => {
  assert.equal(order().open, true);
  assert.equal(order({ fulfillmentStatus: 'completed' }).open, false);
  assert.equal(order({ status: 'cancelled' }).open, false);
  assert.equal(order({ status: 'payment_failed' }).open, false);
  assert.equal(order({ status: 'pending_payment' }).open, true);
  assert.equal(order({ status: 'cancelled' }).fulfillment, 'cancelled');
});

test('a paid order with no fulfilment word is waiting to be confirmed, and one the till does not understand is left alone', () => {
  assert.equal(order({ fulfillmentStatus: null }).fulfillment, 'awaiting_confirmation');
  assert.equal(order({ fulfillmentStatus: '' }).fulfillment, 'awaiting_confirmation');
  assert.equal(order({ fulfillmentStatus: 'CONFIRMED' }).fulfillment, 'confirmed');
  assert.equal(order({ fulfillmentStatus: 'on_the_moon' }).fulfillment, 'unknown');
  assert.equal(nextStep(order({ fulfillmentStatus: 'on_the_moon' })), null);
});

test('the next step is the one the server allows, one at a time', () => {
  assert.deepEqual(nextStep(order({ fulfillmentStatus: 'awaiting_confirmation' })), { to: 'confirmed', label: 'Confirm' });
  assert.deepEqual(nextStep(order({ fulfillmentStatus: 'confirmed' })), { to: 'dispatched', label: 'Ready' });
  assert.deepEqual(nextStep(order({ fulfillmentStatus: 'dispatched' })), { to: 'completed', label: 'Handed over' });
  assert.equal(nextStep(order({ fulfillmentStatus: 'completed' })), null);
});

test('an unpaid order has no step: the server refuses fulfilment of an order that is not paid', () => {
  for (const status of ['pending_payment', 'payment_failed', 'cancelled', '']) {
    assert.equal(nextStep(order({ status })), null, status);
  }
});

test('every state has words, and an unpaid order says so whatever its fulfilment', () => {
  assert.equal(statusLabel(order({ status: 'pending_payment' })), 'Unpaid');
  assert.equal(statusLabel(order({ fulfillmentStatus: 'awaiting_confirmation' })), 'To confirm');
  assert.equal(statusLabel(order({ fulfillmentStatus: 'confirmed' })), 'Packing');
  assert.equal(statusLabel(order({ fulfillmentStatus: 'dispatched' })), 'Ready');
  assert.equal(statusLabel(order({ fulfillmentStatus: 'completed' })), 'Done');
  assert.equal(statusLabel(order({ fulfillmentStatus: 'on_the_moon' })), 'Paid');
});

test('the list is the open orders of this branch, newest first, and an order with no branch shows everywhere', () => {
  const orders = [
    order({ id: 'old', createdAt: '2026-11-23T08:00:00.000Z' }),
    order({ id: 'new', createdAt: '2026-11-23T11:59:00.000Z' }),
    order({ id: 'other', catalogBranchId: 'b-2' }),
    order({ id: 'done', fulfillmentStatus: 'completed' }),
    order({ id: 'void', status: 'cancelled' }),
    order({ id: 'nobranch', catalogBranchId: undefined, createdAt: '2026-11-23T10:00:00.000Z' }),
    order({ id: 'notime', createdAt: undefined }),
  ];
  assert.deepEqual(openOrdersFor(orders, 'b-1').map((o) => o.id), ['new', 'nobranch', 'old', 'notime']);
  assert.deepEqual(openOrdersFor([], 'b-1'), []);
});

test('the total reads with its currency, and when the age is known it reads as one', () => {
  assert.equal(orderTotalWords(order()), 'KES 1,250.50');
  assert.equal(orderTotalWords(order({ grandTotal: null })), 'KES');
  assert.equal(placedWords(order({ createdAt: new Date(NOW - 20_000).toISOString() }), NOW), 'just now');
  assert.equal(placedWords(order(), NOW), '12 min ago');
  assert.equal(placedWords(order({ createdAt: new Date(NOW - 3 * 3_600_000).toISOString() }), NOW), '3 h ago');
  assert.equal(placedWords(order({ createdAt: new Date(NOW - 50 * 3_600_000).toISOString() }), NOW), '2 d ago');
  assert.equal(placedWords(order({ createdAt: undefined }), NOW), '');
  assert.equal(placedWords(order({ createdAt: new Date(NOW + 60_000).toISOString() }), NOW), 'just now', 'a clock a little ahead');
});

test('a role the server does not let list orders is told so, not "check the connection"', () => {
  const denied = describeListFailure(new ApiError('Forbidden', { status: 403 }));
  assert.equal(denied.denied, true);
  assert.match(denied.words, /not allowed to see web orders/);
  const down = describeListFailure(new ApiError('Bad gateway', { status: 502 }));
  assert.equal(down.denied, false);
  assert.match(down.words, /connection/);
  assert.equal(describeListFailure(new Error('network')).denied, false);
});

test('an order that moved on or is gone asks for a refresh; a role that may not says so; the rest is a connection problem', () => {
  assert.deepEqual(describeAdvanceFailure(new ApiError('Cannot move fulfillment from confirmed to confirmed', { status: 409 })).reload, true);
  assert.match(describeAdvanceFailure(new ApiError('x', { status: 409 })).words, /already moved on/);
  assert.deepEqual(describeAdvanceFailure(new ApiError('Order not found', { status: 404 })).reload, true);
  const denied = describeAdvanceFailure(new ApiError('Forbidden', { status: 403 }));
  assert.equal(denied.reload, false);
  assert.match(denied.words, /not allowed/);
  const refused = describeAdvanceFailure(new ApiError('fulfillmentStatus must be confirmed, dispatched, or completed', { status: 400 }));
  assert.match(refused.words, /server said no: fulfillmentStatus must be/);
  const foreign = describeAdvanceFailure(new ApiError('<html>blocked</html>', { status: 403, foreign: true }));
  assert.match(foreign.words, /not allowed/, 'a 403 is a 403');
  const proxy = describeAdvanceFailure(new ApiError('<html>proxy</html>', { status: 400, foreign: true }));
  assert.match(proxy.words, /connection/, 'a web page in the way is not the server saying no');
  assert.match(describeAdvanceFailure(new Error('network down')).words, /connection/);
  assert.match(describeAdvanceFailure(new ApiError('boom', { status: 500 })).words, /connection/);
});

test('the number waiting is the paid orders of this branch that still have a step, not the unpaid ones', async () => {
  const { waitingCount } = await import('../src/lib/web-orders');
  const orders = [
    order({ id: 'a' }),
    order({ id: 'b', fulfillmentStatus: 'confirmed' }),
    order({ id: 'c', status: 'pending_payment' }),
    order({ id: 'd', fulfillmentStatus: 'completed' }),
    order({ id: 'e', catalogBranchId: 'b-2' }),
    order({ id: 'f', status: 'cancelled' }),
    order({ id: 'g', fulfillmentStatus: 'on_the_moon' }),
  ];
  assert.equal(waitingCount(orders, 'b-1'), 2);
  assert.equal(waitingCount(orders, 'b-2'), 1);
  assert.equal(waitingCount([], 'b-1'), 0);
});

test('every step asks first, by the order\'s code, and says it cannot be taken back', async () => {
  const { confirmWords } = await import('../src/lib/web-orders');
  const o = order();
  const asked = [nextStep(o), nextStep(order({ fulfillmentStatus: 'confirmed' })), nextStep(order({ fulfillmentStatus: 'dispatched' }))].map((step) => {
    assert.ok(step);
    return confirmWords(o, step);
  });
  assert.deepEqual(asked.map((words) => words.button), ['Confirm', 'Ready', 'Handed over']);
  for (const words of asked) {
    assert.ok(words.title.includes('AB12CD'), words.title);
    assert.match(words.message, /cannot be taken back/);
  }
});

test('a phone number is what the customer typed with the spacing taken out: stray text never makes a different number', () => {
  assert.equal(order({ customerPhone: '(0712) 345-678' }).phone, '0712345678');
  assert.equal(order({ customerPhone: '+254.712.345.678' }).phone, '+254712345678');
  // Digits pulled out of words would dial somebody else: "ext 12" must not become part of the number.
  assert.equal(order({ customerPhone: '0712345678 ext 12' }).phone, '');
  assert.equal(order({ customerPhone: 'office 0712345678' }).phone, '');
});

test('an amount of nothing, or of blanks, is not a total of zero', () => {
  assert.equal(order({ grandTotal: '' }).totalCents, null);
  assert.equal(order({ grandTotal: '   ' }).totalCents, null);
  assert.equal(order({ grandTotal: '0' }).totalCents, 0);
});

test('a status is read whatever its capitals', () => {
  const shouted = order({ status: 'PAID', fulfillmentStatus: 'CONFIRMED' });
  assert.equal(shouted.paid, true);
  assert.equal(shouted.fulfillment, 'confirmed');
  assert.equal(order({ status: 'Cancelled' }).open, false);
});

test('how long ago changes its unit exactly on the hour and on the day', () => {
  const ago = (ms: number) => placedWords(order({ createdAt: new Date(NOW - ms).toISOString() }), NOW);
  assert.equal(ago(59 * 60_000), '59 min ago');
  assert.equal(ago(60 * 60_000), '1 h ago');
  assert.equal(ago(24 * 3_600_000 - 60_000), '23 h ago');
  assert.equal(ago(24 * 3_600_000), '1 d ago');
});

test('what a foreign answer says is never passed off as the server speaking, and what the server says is cut short', () => {
  const stranger = describeAdvanceFailure(new ApiError('Blocked by the office firewall', { status: 400, foreign: true }));
  assert.match(stranger.words, /connection/);
  assert.doesNotMatch(stranger.words, /firewall/);
  const long = describeAdvanceFailure(new ApiError('x'.repeat(500), { status: 400 }));
  assert.ok(long.words.length < 200, `${long.words.length} characters`);
});
