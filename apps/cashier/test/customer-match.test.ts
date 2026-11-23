import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCustomers } from '../src/lib/customer-match';

const A = { id: 'a', name: 'Amina' };
const B = { id: 'b', name: 'Brian' };

test('no one has the number', () => {
  assert.deepEqual(matchCustomers([]), { kind: 'none' });
});

test('exactly one customer has it', () => {
  assert.deepEqual(matchCustomers([A]), { kind: 'one', customer: A });
});

test('the same customer found twice is still one customer', () => {
  assert.deepEqual(matchCustomers([A, { ...A }]), { kind: 'one', customer: A });
});

test('two customers with the number are never guessed between', () => {
  assert.deepEqual(matchCustomers([A, B]), { kind: 'several' });
  assert.deepEqual(matchCustomers([A, A, B]), { kind: 'several' });
});
