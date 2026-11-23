import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWhen } from '../src/lib/when';

test('a time is shown as day, month and the clock, in the phone time', () => {
  assert.equal(formatWhen(new Date(2026, 10, 23, 10, 15)), '23 Nov, 10:15');
  assert.equal(formatWhen(new Date(2026, 0, 5, 7, 5)), '5 Jan, 07:05');
  assert.equal(formatWhen(new Date(2026, 11, 31, 23, 59).toISOString()), '31 Dec, 23:59');
  assert.equal(formatWhen(new Date(2026, 5, 1, 0, 0).getTime()), '1 Jun, 00:00');
});

test('something that is not a time is a dash, never "Invalid Date"', () => {
  for (const value of [null, undefined, '', 'yesterday', NaN, new Date('nope')]) {
    assert.equal(formatWhen(value as never), '—');
  }
});
