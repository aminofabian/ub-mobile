import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StkOutcome } from '@kiosk/payments';
import { ApiError } from '@kiosk/core';
import {
  PUSH_TIMEOUT_MS,
  PushTimedOut,
  STK_AMOUNT_TOLERANCE_CENTS,
  describePushFailure,
  describeStkOutcome,
} from '../src/lib/stk-step';

const paid = (over: Partial<Extract<StkOutcome, { kind: 'paid' }>> = {}): StkOutcome => ({
  kind: 'paid',
  checkoutRequestId: 'ws_CO_1',
  receiptCode: 'SHK7Y2ABCD',
  amount: 450,
  ...over,
});

test('a confirmed payment of the right amount completes the sale with its code', () => {
  assert.deepEqual(describeStkOutcome(paid(), 45000), { step: 'paid', code: 'SHK7Y2ABCD' });
});

test('the code is cleaned the way the server keeps it', () => {
  assert.deepEqual(describeStkOutcome(paid({ receiptCode: ' shk7y2-abcd ' }), 45000), { step: 'paid', code: 'SHK7Y2ABCD' });
});

test('an amount up to a shilling away is accepted, as the server accepts it', () => {
  assert.equal(STK_AMOUNT_TOLERANCE_CENTS, 100);
  assert.equal(describeStkOutcome(paid({ amount: 450.99 }), 45000).step, 'paid');
  assert.equal(describeStkOutcome(paid({ amount: 449.01 }), 45000).step, 'paid');
  assert.equal(describeStkOutcome(paid({ amount: 451 }), 45000).step, 'paid');
  assert.equal(describeStkOutcome(paid({ amount: 449 }), 45000).step, 'paid');
});

test('an amount more than a shilling away is not completed, and says what was paid', () => {
  for (const amount of [451.01, 448.99, 300, 900]) {
    const step = describeStkOutcome(paid({ amount }), 45000);
    assert.equal(step.step, 'wrong_amount', String(amount));
    assert.match((step as { message: string }).message, /Ask your manager/);
  }
  const step = describeStkOutcome(paid({ amount: 300 }), 45000);
  assert.match((step as { message: string }).message, /300\.00/);
  assert.match((step as { message: string }).message, /450\.00/);
});

test('an amount M-Pesa did not report is not held against the payment', () => {
  assert.equal(describeStkOutcome(paid({ amount: null }), 45000).step, 'paid');
});

test('a payment with no usable code needs the code typed', () => {
  assert.equal(describeStkOutcome(paid({ receiptCode: null }), 45000).step, 'code_needed');
  assert.equal(describeStkOutcome(paid({ receiptCode: 'abc' }), 45000).step, 'code_needed');
  assert.equal(describeStkOutcome(paid({ receiptCode: '---' }), 45000).step, 'code_needed');
});

test('a wrong amount is reported before a missing code', () => {
  assert.equal(describeStkOutcome(paid({ receiptCode: null, amount: 100 }), 45000).step, 'wrong_amount');
});

test('M-Pesa saying it failed is a failure that offers another prompt', () => {
  const step = describeStkOutcome({ kind: 'failed', checkoutRequestId: 'x', reason: 'The customer cancelled' }, 45000);
  assert.equal(step.step, 'failed');
  assert.match((step as { message: string }).message, /The customer cancelled/);
  const bare = describeStkOutcome({ kind: 'failed', checkoutRequestId: 'x' }, 45000);
  assert.equal(bare.step, 'failed');
  assert.doesNotMatch((bare as { message: string }).message, /undefined/);
});

test('not knowing is never a failure, and never invites a second prompt', () => {
  for (const reason of ['timeout', 'no_connection', 'cancelled'] as const) {
    const step = describeStkOutcome({ kind: 'unknown', checkoutRequestId: 'x', reason }, 45000);
    assert.equal(step.step, 'unconfirmed', reason);
    const message = (step as { message: string }).message;
    assert.match(message, /may/, reason);
    assert.match(message, /before sending another prompt/, reason);
    assert.doesNotMatch(message, /failed|did not go through/i, reason);
  }
});

test('a prompt the server refused was not sent, and says why', () => {
  for (const status of [400, 401, 403, 404, 422, 429]) {
    const failure = describePushFailure(new ApiError('Phone number is not valid', { status }));
    assert.equal(failure.sent, 'no', String(status));
    assert.equal(failure.message, 'The prompt was not sent: Phone number is not valid');
  }
  assert.equal(describePushFailure(new ApiError('', { status: 403 })).message, 'The prompt was not sent.');
});

test('a prompt that got no clear answer may have been sent, and the cashier is told to ask the customer', () => {
  const failures = [
    new ApiError('timeout', { status: 408 }),
    new ApiError('bad gateway', { status: 502 }),
    new ApiError('oops', { status: 500 }),
    new TypeError('Network request failed'),
    new PushTimedOut(),
    new Error('anything'),
    null,
  ];
  for (const error of failures) {
    const failure = describePushFailure(error);
    assert.equal(failure.sent, 'maybe', String(error));
    assert.match(failure.message, /may be on the customer's phone/);
    assert.match(failure.message, /Ask them/);
    assert.doesNotMatch(failure.message, /not sent/i);
  }
});

test('the till waits longer for a prompt than for a sale, because the server clears the number first', () => {
  assert.equal(PUSH_TIMEOUT_MS, 45_000);
});

test('what M-Pesa or the server says is shown on one line and never as a web page', () => {
  const said = describeStkOutcome({ kind: 'failed', checkoutRequestId: 'ws_CO_1', reason: 'The customer\ncancelled the request' }, 45000);
  assert.equal(said.step === 'failed' && said.message.startsWith('M-Pesa said: The customer cancelled the request.'), true);
  const page = describeStkOutcome({ kind: 'failed', checkoutRequestId: 'ws_CO_1', reason: '<html>Bad gateway</html>' }, 45000);
  assert.equal(page.step === 'failed' && /^The payment did not go through\./.test(page.message), true);
  assert.equal(describePushFailure(new ApiError('<html>Forbidden</html>', { status: 403, foreign: true })).message, 'The prompt was not sent.');
  assert.equal(describePushFailure(new ApiError('Invalid\nnumber', { status: 400 })).message, 'The prompt was not sent: Invalid number');
});
