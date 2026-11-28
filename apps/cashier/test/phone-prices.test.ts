import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepMarksFor, markAdded, oldestMark } from '../src/lib/phone-prices';

const T1 = Date.parse('2026-11-23T08:00:00.000Z');
const T2 = Date.parse('2026-11-23T10:00:00.000Z');
const line = (itemId: string) => ({ itemId });

test('a new line priced from the phone\'s list takes the age of that list', () => {
  assert.deepEqual(markAdded({}, [], 'a', T1), { a: T1 });
});

test('a new line priced by the shop itself carries no mark, and drops one left from before', () => {
  assert.deepEqual(markAdded({}, [], 'a', null), {});
  assert.deepEqual(markAdded({ a: T1, b: T2 }, [], 'a', null), { b: T2 });
});

test('a line that was already there keeps the price it was rung at, and so its mark', () => {
  const before = [line('a')];
  assert.deepEqual(markAdded({ a: T1 }, before, 'a', T2), { a: T1 });
  assert.deepEqual(markAdded({}, before, 'a', T2), {}, 'a shop price stays a shop price');
  assert.deepEqual(markAdded({ a: T1 }, before, 'a', null), { a: T1 });
});

test('a time that is not a time is no mark', () => {
  for (const bad of [NaN, Infinity, 0, -5, undefined, '5']) {
    assert.deepEqual(markAdded({}, [], 'a', bad as never), {}, String(bad));
  }
});

test('adding does not change the marks it was given', () => {
  const marks = { a: T1 };
  const next = markAdded(marks, [], 'b', T2);
  assert.deepEqual(marks, { a: T1 });
  assert.deepEqual(next, { a: T1, b: T2 });
});

test('marks of lines that are gone are dropped', () => {
  assert.deepEqual(keepMarksFor([line('a')], { a: T1, b: T2 }), { a: T1 });
  assert.deepEqual(keepMarksFor([], { a: T1 }), {});
  assert.deepEqual(keepMarksFor([line('a'), line('c')], { a: T1 }), { a: T1 });
});

test('the oldest list any line was priced from is the one that is told', () => {
  assert.equal(oldestMark([line('a'), line('b')], { a: T2, b: T1 }), T1);
  assert.equal(oldestMark([line('a')], { a: T2, b: T1 }), T2, 'a mark of a line that is not in the basket is not counted');
  assert.equal(oldestMark([line('a')], {}), null);
  assert.equal(oldestMark([], { a: T1 }), null);
});

test('an item called after something every object has is still an ordinary item', () => {
  for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(oldestMark([line(id)], {}), null, id);
    assert.deepEqual(keepMarksFor([line(id)], {}), {}, id);
  }
  const marked = markAdded({}, [], 'constructor', T1);
  assert.equal(oldestMark([line('constructor')], marked), T1);
});
