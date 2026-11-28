import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '@kiosk/core';
import { LOADING, loadedFailure, loadedFromRead, loadedOk, mapLoaded, type Loaded } from '../src/lib/loaded';
import { creditView, ordersView, plural, shiftsView, stockView, takingsView } from '../src/lib/today';
import type { OwnerOrder } from '../src/lib/orders';
import type { Pulse } from '../src/lib/pulse';

const fail = (status: number, extra: { foreign?: boolean } = {}) => new ApiError('x', { status, ...extra });

function pulse(over: Partial<Pulse> = {}): Pulse {
  return { date: '2026-11-24', salesCount: 42, revenueCents: 12_505_050, profitCents: 4_505_050, expensesCents: 100_000, netCents: 4_405_050, openShifts: 2, ...over };
}

function order(over: Partial<OwnerOrder> = {}): OwnerOrder {
  return { id: 'o-1', code: 'AB12CD', status: 'paid', fulfilment: 'awaiting_confirmation', totalCents: 100, currency: 'KES', customer: 'W', phone: null, branch: null, placedAt: 1, ...over };
}

test('a thing read starts as loading and ok holds what was read, fresh', () => {
  assert.deepEqual(LOADING, { state: 'loading' });
  assert.deepEqual(loadedOk(5), { state: 'ok', value: 5, stale: false });
});

test('a read that failed shows why, and a role that is not allowed is told so', () => {
  assert.deepEqual(loadedFailure(fail(403), LOADING), { state: 'denied', words: 'Your role is not allowed to see this.' });
  const failed = loadedFailure(fail(500), LOADING);
  assert.equal(failed.state, 'failed');
  assert.match('words' in failed ? failed.words : '', /server had a problem/);
  const offline = loadedFailure(new Error('offline'), LOADING);
  assert.match('words' in offline ? offline.words : '', /Could not reach/);
});

test('a failed refresh keeps what was read and marks it old, except when the role no longer allows it', () => {
  const held: Loaded<number> = loadedOk(7);
  assert.deepEqual(loadedFailure(fail(500), held), { state: 'ok', value: 7, stale: true });
  assert.deepEqual(loadedFailure(new Error('offline'), held), { state: 'ok', value: 7, stale: true });
  assert.equal(loadedFailure(fail(403), held).state, 'denied');
  assert.deepEqual(loadedFailure(fail(403, { foreign: true }), held), { state: 'ok', value: 7, stale: true });
  const failed = loadedFailure(fail(403, { foreign: true }), LOADING);
  assert.equal(failed.state, 'failed');
  assert.match('words' in failed ? failed.words : '', /not reaching the shop/);
  const again = loadedFailure(fail(500), { state: 'failed', words: 'earlier' } as Loaded<number>);
  assert.equal(again.state, 'failed');
});

test('an answer the app could not read is a failure, and never an empty result', () => {
  assert.deepEqual(loadedFromRead(3, LOADING), { state: 'ok', value: 3, stale: false });
  assert.deepEqual(loadedFromRead(0, LOADING), { state: 'ok', value: 0, stale: false });
  assert.deepEqual(loadedFromRead([], LOADING), { state: 'ok', value: [], stale: false });
  const failed = loadedFromRead<number>(null, LOADING);
  assert.equal(failed.state, 'failed');
  assert.match('words' in failed ? failed.words : '', /does not understand/);
  assert.deepEqual(loadedFromRead<number>(null, loadedOk(9)), { state: 'ok', value: 9, stale: true });
  assert.deepEqual(loadedFromRead(4, loadedOk(9)), { state: 'ok', value: 4, stale: false });
});

test('what was read can be turned into something else, and a read that is not an answer stays what it was', () => {
  const double = (n: number) => n * 2;
  assert.deepEqual(mapLoaded(loadedOk(4), double), { state: 'ok', value: 8, stale: false });
  assert.deepEqual(mapLoaded<number, number>({ state: 'ok', value: 4, stale: true }, double), { state: 'ok', value: 8, stale: true });
  assert.deepEqual(mapLoaded(LOADING as Loaded<number>, double), { state: 'loading' });
  const denied: Loaded<number> = { state: 'denied', words: 'no' };
  const failed: Loaded<number> = { state: 'failed', words: 'down' };
  assert.deepEqual(mapLoaded(denied, double), { state: 'denied', words: 'no' });
  assert.deepEqual(mapLoaded(failed, double), { state: 'failed', words: 'down' });
});

test('counts are said in the singular and the plural', () => {
  assert.equal(plural(0, 'sale', 'sales'), '0 sales');
  assert.equal(plural(1, 'sale', 'sales'), '1 sale');
  assert.equal(plural(2, 'sale', 'sales'), '2 sales');
});

test('takings show the day, how many sales made it, and yesterday when it is known', () => {
  assert.deepEqual(takingsView(pulse(), pulse({ revenueCents: 11_800_000 })), {
    value: 'KES 125,050.50',
    note: '42 sales · yesterday KES 118,000.00',
    tone: 'ok',
    trend: { dir: 'up', label: '6%', spoken: '6 percent up on yesterday' },
  });
  assert.deepEqual(takingsView(pulse({ salesCount: 1 }), null), { value: 'KES 125,050.50', note: '1 sale', tone: 'ok', trend: null });
  assert.deepEqual(takingsView(pulse({ salesCount: null }), pulse({ revenueCents: 0 })), { value: 'KES 125,050.50', note: 'yesterday KES 0.00', tone: 'ok', trend: { dir: 'up', label: 'new', spoken: 'up on yesterday' } });
  assert.deepEqual(takingsView(pulse({ revenueCents: null, salesCount: null }), pulse({ revenueCents: null })), { value: '—', note: null, tone: 'quiet', trend: null });
  assert.deepEqual(takingsView(pulse({ revenueCents: 0, salesCount: 0 }), null), { value: 'KES 0.00', note: '0 sales', tone: 'ok', trend: null });
});

test('open tills are counted, and none open is said plainly', () => {
  assert.deepEqual(shiftsView(pulse({ openShifts: 2 })), { value: '2', note: 'Tills are open', tone: 'ok' });
  assert.deepEqual(shiftsView(pulse({ openShifts: 1 })), { value: '1', note: 'Till is open', tone: 'ok' });
  assert.deepEqual(shiftsView(pulse({ openShifts: 0 })), { value: '0', note: 'No till is open', tone: 'quiet' });
  assert.deepEqual(shiftsView(pulse({ openShifts: null })), { value: '—', note: null, tone: 'quiet' });
});

test('orders waiting for the owner are counted and ask for attention', () => {
  assert.deepEqual(ordersView([]), { value: '0', note: 'Nothing waiting for you', tone: 'quiet' });
  assert.deepEqual(ordersView([order({ fulfilment: 'confirmed' })]), { value: '0', note: 'Nothing waiting for you', tone: 'quiet' });
  assert.deepEqual(ordersView([order()]), { value: '1', note: 'Order to confirm', tone: 'ask' });
  assert.deepEqual(ordersView([order(), order({ id: 'o-2' }), order({ id: 'o-3', fulfilment: 'dispatched' })]), { value: '2', note: 'Orders to confirm', tone: 'ask' });
});

test('stock that needs attention is the items out and the items running low, said apart', () => {
  assert.deepEqual(stockView({ low: 0, out: 0 }), { value: '0', note: 'Nothing is low or out', tone: 'quiet' });
  assert.deepEqual(stockView({ low: 12, out: 3 }), { value: '15', note: '3 out · 12 running low', tone: 'warn' });
  assert.deepEqual(stockView({ low: 12, out: 0 }), { value: '12', note: '12 running low', tone: 'warn' });
  assert.deepEqual(stockView({ low: 0, out: 3 }), { value: '3', note: '3 out', tone: 'warn' });
});

test('credit shows what is owed, by how many, and what came in today', () => {
  assert.deepEqual(creditView({ owedCents: 2_430_050, openTabs: 17, collectedCents: 200_000, paymentCount: 4 }), { value: 'KES 24,300.50', note: '17 people · KES 2,000.00 paid today', tone: 'warn' });
  assert.deepEqual(creditView({ owedCents: 5_000, openTabs: 1, collectedCents: 0, paymentCount: 0 }), { value: 'KES 50.00', note: '1 person', tone: 'warn' });
  assert.deepEqual(creditView({ owedCents: 0, openTabs: 0, collectedCents: 0, paymentCount: 0 }), { value: 'KES 0.00', note: '0 people', tone: 'quiet' });
  assert.deepEqual(creditView({ owedCents: null, openTabs: null, collectedCents: null, paymentCount: null }), { value: '—', note: null, tone: 'quiet' });
  assert.deepEqual(creditView({ owedCents: 100, openTabs: null, collectedCents: 500, paymentCount: 1 }), { value: 'KES 1.00', note: 'KES 5.00 paid today', tone: 'warn' });
});
