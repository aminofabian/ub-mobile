import assert from 'node:assert/strict';
import test from 'node:test';
import { describeTillSend } from '../src/lib/till-send-words';

test('empty tills: queued wording', () => {
  assert.match(describeTillSend('order', []), /queued for the till/);
});

test('online till: sent and will print', () => {
  assert.match(
    describeTillSend('order', [{ userId: '1', name: 'Amina', online: true }]),
    /sent to Amina.*print/,
  );
});

test('offline till: waiting until they open Sell', () => {
  assert.match(
    describeTillSend('order', [{ userId: '1', name: 'Kamau', online: false }]),
    /Kamau is not on Sell/,
  );
});

test('receipt label', () => {
  assert.match(describeTillSend('receipt', []), /^Receipt/);
});
