import assert from 'node:assert/strict';
import test from 'node:test';
import { daysBetween, readDate, shortDate, todayOn } from '../src/lib/dates';

test('a date as the server writes it', () => {
  assert.equal(readDate('2026-11-23'), '2026-11-23');
  assert.equal(readDate('2026-11-23T10:00:00Z'), '2026-11-23');
  assert.equal(readDate([2026, 1, 5]), '2026-01-05');
  assert.equal(readDate([2026, 1]), '');
  assert.equal(readDate('yesterday'), '');
  assert.equal(readDate(null), '');
});

test('today is the phone\'s own calendar day, with zeros kept', () => {
  assert.equal(todayOn(new Date(2026, 0, 5, 23, 59).getTime()), '2026-01-05');
  assert.equal(todayOn(new Date(2026, 10, 23, 0, 1).getTime()), '2026-11-23');
});

test('days between two dates, either way round', () => {
  assert.equal(daysBetween('2026-11-23', '2026-11-30'), 7);
  assert.equal(daysBetween('2026-11-23', '2026-11-22'), -1);
  assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1);
  assert.equal(daysBetween('2026-11-23', 'soon'), null);
});

test('a short date reads "23 Nov", and nothing for no moment', () => {
  assert.equal(shortDate(new Date(2026, 10, 23, 14, 0).getTime()), '23 Nov');
  assert.equal(shortDate(new Date(2026, 0, 5, 9, 0).getTime()), '5 Jan');
  assert.equal(shortDate(null), '');
  assert.equal(shortDate(Number.NaN), '');
});

test('a date in parts needs three whole numbers above zero, and ignores any after the third', () => {
  assert.equal(readDate([2026, 11, 23]), '2026-11-23', 'exactly three parts');
  assert.equal(readDate([2026, 11, 23, 9, 30]), '2026-11-23', 'a time after the date is left out');
  assert.equal(readDate([26, 1, 5]), '0026-01-05');
  assert.equal(readDate([2026, 0, 5]), '', 'month nought');
  assert.equal(readDate([2026, 1, 0]), '', 'day nought');
  assert.equal(readDate([0, 1, 5]), '', 'year nought');
  assert.equal(readDate([2026, -1, 5]), '');
  assert.equal(readDate([2026.5, 1, 5]), '', 'not a whole number');
  assert.equal(readDate(['2026', 1, 5]), '', 'not a number');
  assert.equal(readDate([]), '');
});
