import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatQty,
  MAX_QTY_UNITS,
  parseQty,
  QTY_SCALE,
  qtyProblemWords,
  qtyToUnits,
  unitsToQty,
  type QtyProblem,
} from '../src/stock-qty';

test('a quantity is read to the ten-thousandth', () => {
  assert.deepEqual(parseQty('12'), { ok: true, units: 120000 });
  assert.deepEqual(parseQty('2.5'), { ok: true, units: 25000 });
  assert.deepEqual(parseQty('.5'), { ok: true, units: 5000 });
  assert.deepEqual(parseQty('1.'), { ok: true, units: 10000 });
  assert.deepEqual(parseQty('  0.3  '), { ok: true, units: 3000 });
  assert.deepEqual(parseQty('007.5'), { ok: true, units: 75000 });
  assert.deepEqual(parseQty('0.0001'), { ok: true, units: 1 });
  assert.deepEqual(parseQty('1.5000'), { ok: true, units: 15000 });
  assert.deepEqual(parseQty('1.500000000'), { ok: true, units: 15000 });
});

test('a digit past the fourth decimal is refused, zeros there say nothing', () => {
  assert.deepEqual(parseQty('1.23456'), { ok: false, problem: 'too_many_decimals' });
  assert.deepEqual(parseQty('0.00005'), { ok: false, problem: 'too_many_decimals' });
  assert.deepEqual(parseQty('1.00010'), { ok: true, units: 10001 });
});

test('anything that is not digits and one point is not a quantity', () => {
  for (const bad of ['1,5', '1,250', '1e3', '-2', '+1', '1.2.3', 'abc', '.', '1 2', '1/2', '٣', '１２', '0x10', 'Infinity', 'NaN']) {
    assert.deepEqual(parseQty(bad), { ok: false, problem: 'not_a_number' }, JSON.stringify(bad));
  }
  assert.deepEqual(parseQty(''), { ok: false, problem: 'empty' });
  assert.deepEqual(parseQty('   '), { ok: false, problem: 'empty' });
});

test('zero is a quantity only where counting nothing means something', () => {
  assert.deepEqual(parseQty('0'), { ok: false, problem: 'zero' });
  assert.deepEqual(parseQty('0.0'), { ok: false, problem: 'zero' });
  assert.deepEqual(parseQty('.0000'), { ok: false, problem: 'zero' });
  assert.deepEqual(parseQty('0', { allowZero: true }), { ok: true, units: 0 });
  assert.deepEqual(parseQty('0.00', { allowZero: true }), { ok: true, units: 0 });
});

test('a million is the most one box takes', () => {
  assert.deepEqual(parseQty('1000000'), { ok: true, units: MAX_QTY_UNITS });
  assert.deepEqual(parseQty('1000000.0001'), { ok: false, problem: 'too_big' });
  assert.deepEqual(parseQty('1000001'), { ok: false, problem: 'too_big' });
  assert.deepEqual(parseQty('99999999'), { ok: false, problem: 'too_big' });
  assert.deepEqual(parseQty('0000000001'), { ok: true, units: QTY_SCALE });
});

test('how much to add is exact where floating-point is not', () => {
  assert.notEqual(10.3 - 7.1, 3.2, 'the trap: plain numbers get this wrong');
  const now = qtyToUnits(10.3);
  const target = qtyToUnits(7.1);
  assert.equal(now, 103000);
  assert.equal(target, 71000);
  assert.equal(unitsToQty((now as number) - (target as number)), 3.2);
  assert.equal(qtyToUnits(0.1 + 0.2), 3000);
  assert.equal(qtyToUnits(1.005), 10050);
});

test('what the server sent is read as a number or as text, and nothing else is', () => {
  assert.equal(qtyToUnits(2.5), 25000);
  assert.equal(qtyToUnits('2.5'), 25000);
  assert.equal(qtyToUnits(' 12 '), 120000);
  assert.equal(qtyToUnits('0.0001'), 1);
  assert.equal(qtyToUnits(0), 0);
  assert.equal(qtyToUnits('0'), 0);
  assert.equal(qtyToUnits(-3), -30000, 'a shop that sold below zero has a negative stock');
  assert.equal(qtyToUnits('-3.5'), -35000);
  for (const bad of [null, undefined, '', 'abc', '1e5', '1,5', NaN, Infinity, -Infinity, {}, [], true, 1e15, '9999999999999']) {
    assert.equal(qtyToUnits(bad), null, String(bad));
  }
});

test('units go back to the number the server is sent', () => {
  assert.equal(unitsToQty(32000), 3.2);
  assert.equal(unitsToQty(1), 0.0001);
  assert.equal(unitsToQty(0), 0);
  assert.equal(unitsToQty(120000), 12);
  assert.equal(unitsToQty(-5000), -0.5);
});

test('a quantity is shown without trailing zeros, with the thousands grouped', () => {
  assert.equal(formatQty(25000), '2.5');
  assert.equal(formatQty(10000), '1');
  assert.equal(formatQty(0), '0');
  assert.equal(formatQty(-30000), '-3');
  assert.equal(formatQty(1), '0.0001');
  assert.equal(formatQty(-1), '-0.0001');
  assert.equal(formatQty(12345000), '1,234.5');
  assert.equal(formatQty(100000000), '10,000');
  assert.equal(formatQty(12345678900), '1,234,567.89');
  assert.equal(formatQty(999990000), '99,999');
});

test('each problem has words of its own', () => {
  const problems: QtyProblem[] = ['empty', 'not_a_number', 'too_many_decimals', 'zero', 'too_big'];
  const words = problems.map((problem) => qtyProblemWords(problem));
  assert.equal(new Set(words).size, problems.length);
  for (const sentence of words) assert.ok(sentence.length > 5);
});

test('a quantity is read up to a billion, in either direction, and no further', () => {
  assert.equal(qtyToUnits(1_000_000_000), 10_000_000_000_000);
  assert.equal(qtyToUnits(-1_000_000_000), -10_000_000_000_000);
  assert.equal(qtyToUnits(1_000_000_001), null);
  assert.equal(qtyToUnits(-1_000_000_001), null);
});
