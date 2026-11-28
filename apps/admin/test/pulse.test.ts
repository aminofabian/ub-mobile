import assert from 'node:assert/strict';
import test from 'node:test';
import { dayBefore, dayWords, readPulse } from '../src/lib/pulse';

test('a day is said as its weekday, its number and its month', () => {
  assert.equal(dayWords('2026-11-24'), 'Tuesday 24 November');
  assert.equal(dayWords('2026-01-01'), 'Thursday 1 January');
  assert.equal(dayWords('2024-02-29'), 'Thursday 29 February');
  assert.equal(dayWords('2026-12-31'), 'Thursday 31 December');
  assert.equal(dayWords('2026-03-01'), 'Sunday 1 March');
  assert.equal(dayWords('2026-06-14'), 'Sunday 14 June');
  assert.equal(dayWords('2026-07-04'), 'Saturday 4 July');
  assert.equal(dayWords('2026-08-17'), 'Monday 17 August');
  assert.equal(dayWords('2026-09-02'), 'Wednesday 2 September');
  assert.equal(dayWords('2026-10-16'), 'Friday 16 October');
  assert.equal(dayWords('2026-05-05'), 'Tuesday 5 May');
  assert.equal(dayWords('2026-04-30'), 'Thursday 30 April');
  assert.equal(dayWords('2026-02-28'), 'Saturday 28 February');
});

test('a day that is not on the calendar has no words', () => {
  for (const bad of ['', '2026-02-30', 'today', '2026-13-01', '2026-11-24 ']) assert.equal(dayWords(bad), '', bad);
});

test('the finance pulse is read into whole cents and counts', () => {
  const pulse = readPulse({
    date: '2026-11-24',
    branchId: null,
    salesCount: 42,
    revenue: '125050.50',
    cogs: '80000.00',
    grossProfit: 45050.5,
    grossMarginPct: '36.0',
    expensesTotal: '1000.00',
    netOperating: '44050.50',
    openShifts: 2,
  });
  assert.deepEqual(pulse, {
    date: '2026-11-24',
    salesCount: 42,
    revenueCents: 12_505_050,
    profitCents: 4_505_050,
    expensesCents: 100_000,
    netCents: 4_405_050,
    openShifts: 2,
  });
});

test('a figure the server did not send is not known, and is not zero', () => {
  assert.deepEqual(readPulse({ date: '2026-11-24' }), {
    date: '2026-11-24',
    salesCount: null,
    revenueCents: null,
    profitCents: null,
    expensesCents: null,
    netCents: null,
    openShifts: null,
  });
});

test('a day that lost money has a negative profit and a net below zero', () => {
  const pulse = readPulse({ date: '2026-11-24', grossProfit: '-120.50', netOperating: '-4500.00' });
  assert.equal(pulse?.profitCents, -12_050);
  assert.equal(pulse?.netCents, -450_000);
});

test('a count that is not a whole number of at least zero is not known', () => {
  for (const bad of [-1, 1.5, '3', Number.NaN, Infinity, null, {}]) {
    const pulse = readPulse({ date: '2026-11-24', salesCount: bad, openShifts: bad });
    assert.equal(pulse?.salesCount, null, String(bad));
    assert.equal(pulse?.openShifts, null, String(bad));
  }
  const zero = readPulse({ date: '2026-11-24', salesCount: 0, openShifts: 0 });
  assert.equal(zero?.salesCount, 0);
  assert.equal(zero?.openShifts, 0);
});

test('an answer with no real date is not a pulse', () => {
  const bad: unknown[] = [null, undefined, 'x', 5, [], {}, { date: '' }, { date: 20_261_124 }, { date: '2026-13-01' }, { date: '2026-02-30' }, { date: '24-11-2026' }, { date: '2026-11-24T00:00' }];
  for (const raw of bad) assert.equal(readPulse(raw), null, JSON.stringify(raw));
});

test('the day before a date, across months, years and leap days', () => {
  assert.equal(dayBefore('2026-11-24'), '2026-11-23');
  assert.equal(dayBefore('2026-03-01'), '2026-02-28');
  assert.equal(dayBefore('2024-03-01'), '2024-02-29');
  assert.equal(dayBefore('2026-01-01'), '2025-12-31');
  assert.equal(dayBefore('2026-12-01'), '2026-11-30');
  assert.equal(dayBefore('0001-01-02'), '0001-01-01');
});

test('there is no day before something that is not a calendar day', () => {
  for (const bad of ['', '2026-02-30', '2026-13-01', '2026-00-10', '2026-11-00', '2026-11-31', '26-11-24', 'today', '2026-11-24 ']) {
    assert.equal(dayBefore(bad), null, bad);
  }
});

test('an array is not a pulse, even one that carries the right names', () => {
  assert.equal(readPulse(Object.assign([], { date: '2026-11-24', revenue: '1000.00' })), null);
});

test('a day that does not exist is not a day, whichever way it overflows', () => {
  for (const bad of ['2026-13-01', '2026-00-10', '2026-01-00', '2026-01-32', '2026-02-29', '2026-04-31', '2026-11-31', '2026-12-32']) {
    assert.equal(dayBefore(bad), null, bad);
    assert.equal(dayWords(bad), '', bad);
  }
  assert.equal(dayBefore('2024-02-29'), '2024-02-28');
  assert.equal(dayBefore('2026-12-31'), '2026-12-30');
});
