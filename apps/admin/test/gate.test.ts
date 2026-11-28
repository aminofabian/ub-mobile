import assert from 'node:assert/strict';
import test from 'node:test';
import { createGate } from '../src/lib/gate';

test('the first caller goes through and the second is turned away until the first has left', () => {
  const gate = createGate();
  assert.equal(gate.held(), false);
  assert.equal(gate.enter(), true);
  assert.equal(gate.held(), true);
  assert.equal(gate.enter(), false);
  assert.equal(gate.enter(), false);
  gate.leave();
  assert.equal(gate.held(), false);
  assert.equal(gate.enter(), true);
});

test('leaving an open gate changes nothing, and two gates do not share a door', () => {
  const one = createGate();
  const other = createGate();
  one.leave();
  assert.equal(one.held(), false);
  assert.equal(one.enter(), true);
  assert.equal(other.enter(), true);
  assert.equal(one.enter(), false);
  other.leave();
  assert.equal(one.held(), true);
});

test('two taps in the same moment cannot both go through, which is why it is read at once and not at the next draw', () => {
  const gate = createGate();
  // Both taps run before anything is drawn again: a flag kept in component state would be false for both.
  const taps = [gate.enter(), gate.enter()];
  assert.deepEqual(taps, [true, false]);
});
