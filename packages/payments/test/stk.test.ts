import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ApiClient } from '@kiosk/core';
import { initiateStkPush, pollStkStatus, waitForStk, type StkStatusResponse } from '../src/index';

type Reply = StkStatusResponse | Error;

const PENDING: StkStatusResponse = { status: 'PENDING', success: false, failed: false, pending: true };
const PAID: StkStatusResponse = {
  status: 'SUCCESS',
  success: true,
  failed: false,
  pending: false,
  gatewayTransactionId: 'SHK7Y2ABCD',
  amount: 450,
};
const FAILED: StkStatusResponse = {
  status: 'FAILED',
  success: false,
  failed: true,
  pending: false,
  failureReason: 'The customer cancelled the request',
};

/** An api whose status answers come from a list, one per check, and whose clock moves only when the wait sleeps. */
function waiting(replies: Reply[]) {
  const asked: string[] = [];
  let clock = 0;
  const api = {
    get: async (path: string) => {
      asked.push(path);
      const reply = replies[Math.min(asked.length - 1, replies.length - 1)];
      if (reply instanceof Error) throw reply;
      return reply;
    },
  } as unknown as ApiClient;
  const options = {
    intervalMs: 3000,
    timeoutMs: 90_000,
    now: () => clock,
    sleep: async (ms: number) => {
      clock += ms;
    },
  };
  return { api, asked, options };
}

test('a customer who pays after a few checks is paid, with the M-Pesa code and the amount', async () => {
  const { api, asked, options } = waiting([PENDING, PENDING, PAID]);
  const outcome = await waitForStk(api, 'ws_CO_1', options);
  assert.deepEqual(outcome, { kind: 'paid', checkoutRequestId: 'ws_CO_1', receiptCode: 'SHK7Y2ABCD', amount: 450 });
  assert.equal(asked.length, 3);
});

test('M-Pesa saying the payment failed is a failure, with its reason', async () => {
  const { api, options } = waiting([PENDING, FAILED]);
  const outcome = await waitForStk(api, 'ws_CO_1', options);
  assert.deepEqual(outcome, {
    kind: 'failed',
    checkoutRequestId: 'ws_CO_1',
    reason: 'The customer cancelled the request',
  });
});

test('a failure with no reason is still a failure', async () => {
  const { api, options } = waiting([{ ...FAILED, failureReason: undefined }]);
  const outcome = await waitForStk(api, 'ws_CO_1', options);
  assert.deepEqual(outcome, { kind: 'failed', checkoutRequestId: 'ws_CO_1' });
});

test('a check that cannot be made does not end the wait', async () => {
  const { api, asked, options } = waiting([new TypeError('Network request failed'), new Error('API error: 503'), PAID]);
  const outcome = await waitForStk(api, 'ws_CO_1', options);
  assert.equal(outcome.kind, 'paid');
  assert.equal(asked.length, 3);
});

test('a customer who has not paid when the time is up is not known to have failed', async () => {
  const { api, asked, options } = waiting([PENDING]);
  const outcome = await waitForStk(api, 'ws_CO_1', options);
  assert.deepEqual(outcome, { kind: 'unknown', checkoutRequestId: 'ws_CO_1', reason: 'timeout' });
  // Checks at 0, 3, 6 ... 87 seconds: 30 of them, and none after the time is up.
  assert.equal(asked.length, 30);
});

test('never getting an answer is told apart from the customer not paying', async () => {
  const { api, options } = waiting([new TypeError('Network request failed')]);
  const outcome = await waitForStk(api, 'ws_CO_1', options);
  assert.deepEqual(outcome, { kind: 'unknown', checkoutRequestId: 'ws_CO_1', reason: 'no_connection' });
});

test('one answer and then silence is a timeout, not a lost connection', async () => {
  const { api, options } = waiting([PENDING, new TypeError('Network request failed')]);
  const outcome = await waitForStk(api, 'ws_CO_1', options);
  assert.equal(outcome.kind === 'unknown' && outcome.reason, 'timeout');
});

test('a status that is neither paid nor failed is still waiting, whatever it is called', async () => {
  const odd: StkStatusResponse = { status: 'QUEUED_AT_GATEWAY', success: false, failed: false, pending: false };
  const { api, options } = waiting([odd, odd, PAID]);
  const outcome = await waitForStk(api, 'ws_CO_1', options);
  assert.equal(outcome.kind, 'paid');
});

test('a payment confirmed without a code is paid, and says it has no code', async () => {
  const { api, options } = waiting([{ ...PAID, gatewayTransactionId: null, amount: null }]);
  const outcome = await waitForStk(api, 'ws_CO_1', options);
  assert.deepEqual(outcome, { kind: 'paid', checkoutRequestId: 'ws_CO_1', receiptCode: null, amount: null });
  const blank = waiting([{ ...PAID, gatewayTransactionId: '   ' }]);
  const second = await waitForStk(blank.api, 'ws_CO_1', blank.options);
  assert.equal(second.kind === 'paid' && second.receiptCode, null);
});

test('stopping the wait stops the checks at once', async () => {
  const controller = new AbortController();
  const asked: string[] = [];
  const api = {
    get: async (path: string) => {
      asked.push(path);
      if (asked.length === 2) controller.abort();
      return PENDING;
    },
  } as unknown as ApiClient;
  const outcome = await waitForStk(api, 'ws_CO_1', {
    intervalMs: 5,
    timeoutMs: 10_000,
    signal: controller.signal,
  });
  assert.deepEqual(outcome, { kind: 'unknown', checkoutRequestId: 'ws_CO_1', reason: 'cancelled' });
  assert.equal(asked.length, 2);
});

test('a wait that was stopped before it started asks nothing', async () => {
  const controller = new AbortController();
  controller.abort();
  const { api, asked } = waiting([PAID]);
  const outcome = await waitForStk(api, 'ws_CO_1', { signal: controller.signal });
  assert.equal(outcome.kind === 'unknown' && outcome.reason, 'cancelled');
  assert.equal(asked.length, 0);
});

test('the real clock ends a wait too', async () => {
  const { api } = waiting([PENDING]);
  const started = Date.now();
  const outcome = await waitForStk(api, 'ws_CO_1', { intervalMs: 5, timeoutMs: 40 });
  assert.equal(outcome.kind, 'unknown');
  assert.ok(Date.now() - started < 2000);
});

test('the request id is encoded into the status address', async () => {
  const { api, asked } = waiting([PAID]);
  await pollStkStatus(api, 'ws CO/1&x=2');
  assert.equal(asked[0], '/api/v1/payments/mpesa/stk/push/status?checkoutRequestId=ws%20CO%2F1%26x%3D2');
});

test('one status check says whether the customer has paid, and what was paid', async () => {
  const paid = await pollStkStatus(waiting([PAID]).api, 'ws_CO_1');
  assert.equal(paid.status, 'completed');
  assert.equal(paid.receiptCode, 'SHK7Y2ABCD');
  assert.equal(paid.amount, 450);
  const failed = await pollStkStatus(waiting([FAILED]).api, 'ws_CO_1');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.message, 'The customer cancelled the request');
  const waitingStatus = await pollStkStatus(waiting([PENDING]).api, 'ws_CO_1');
  assert.equal(waitingStatus.status, 'pending');
  assert.equal(waitingStatus.receiptCode, undefined);
});

test('a prompt sent with a key carries that key, so the same attempt is recognised', async () => {
  const sent: { path: string; body: unknown; options: unknown }[] = [];
  const api = {
    post: async (path: string, body: unknown, options: unknown) => {
      sent.push({ path, body, options });
      return { accepted: true, checkoutRequestId: 'ws_CO_1', message: 'Sent' };
    },
  } as unknown as ApiClient;
  const keyed = await initiateStkPush(api, { phoneNumber: '0712345678', amount: 450, idempotencyKey: 'attempt-1' });
  assert.deepEqual(keyed, { accepted: true, checkoutRequestId: 'ws_CO_1', message: 'Sent', status: 'pending' });
  assert.deepEqual(sent[0].options, { idempotent: true, idempotencyKey: 'attempt-1' });
  assert.equal(sent[0].path, '/api/v1/payments/mpesa/stk/push');
  assert.deepEqual(sent[0].body, { phoneNumber: '0712345678', amount: 450, description: 'POS payment' });
  await initiateStkPush(api, { phoneNumber: '0712345678', amount: 450, description: 'Sale 7' });
  assert.deepEqual(sent[1].options, { idempotent: true });
  assert.equal((sent[1].body as { description: string }).description, 'Sale 7');
});

test('a prompt the server did not accept is a failure', async () => {
  const api = {
    post: async () => ({ accepted: false, message: 'No STK rail is active' }),
  } as unknown as ApiClient;
  const outcome = await initiateStkPush(api, { phoneNumber: '0712345678', amount: 450 });
  assert.equal(outcome.status, 'failed');
  assert.equal(outcome.accepted, false);
  assert.equal(outcome.message, 'No STK rail is active');
});
