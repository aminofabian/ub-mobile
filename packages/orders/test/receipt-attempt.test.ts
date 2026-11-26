import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HALF_DONE_WORDS,
  planAttempt,
  receiptFailureWords,
  receiptSignature,
  sendAttempt,
  type ReceiptAttempt,
  type ReceiptTools,
} from '../src/lib/receipt-attempt';

const NOW = Date.UTC(2026, 10, 24, 5, 30, 15, 987);

function maker() {
  let n = 0;
  return { key: () => `key-${(n += 1)}`, now: () => NOW };
}

const lines = [
  { purchaseOrderLineId: 'l-1', qtyReceived: 4 },
  { purchaseOrderLineId: 'l-2', qtyReceived: 10 },
];
const sig = receiptSignature({ purchaseOrderId: 'po-1', branchId: 'b-1', lines });

function started(): ReceiptAttempt {
  const plan = planAttempt(null, { signature: sig, poNumber: 'PO-0007' }, maker());
  assert.equal(plan.kind, 'go');
  return plan.attempt;
}

/** Tools that remember what was sent, with scripted failures. */
function tools(script: { receipt?: (key: string, call: number) => Promise<{ goodsReceiptId: string }>; invoice?: (id: string, key: string, call: number) => Promise<unknown> } = {}) {
  const receipts: string[] = [];
  const invoices: { id: string; key: string }[] = [];
  const t: ReceiptTools = {
    postGoodsReceipt: async (key) => {
      receipts.push(key);
      return script.receipt ? script.receipt(key, receipts.length) : { goodsReceiptId: 'grn-1' };
    },
    postInvoice: async (id, key) => {
      invoices.push({ id, key });
      return script.invoice ? script.invoice(id, key, invoices.length) : {};
    },
  };
  return { t, receipts, invoices };
}

test('a first press makes an attempt with its own two keys, its times fixed, and an invoice number from the order', () => {
  const attempt = started();
  assert.equal(attempt.goodsReceiptKey, 'key-1');
  assert.equal(attempt.invoiceKey, 'key-2');
  assert.equal(attempt.invoiceNumber, `PO-0007-R${String(NOW).slice(-4)}`);
  assert.equal(attempt.receivedAt, '2026-11-24T05:30:15.987Z');
  assert.equal(attempt.invoiceDate, '2026-11-24');
  assert.equal(attempt.goodsReceiptId, null);
});

test('pressing again for the same thing is the same attempt, with the same keys and the same times, even a day later', () => {
  const first = started();
  const later = planAttempt(first, { signature: sig, poNumber: 'PO-0007' }, { key: () => 'other', now: () => NOW + 86_400_000 });
  assert.equal(later.kind, 'go');
  assert.equal(later.attempt, first);
  assert.equal(later.attempt.goodsReceiptKey, 'key-1');
  assert.equal(later.attempt.receivedAt, '2026-11-24T05:30:15.987Z');
});

test('asking for something else before anything was received is a fresh attempt with fresh keys', () => {
  const first = started();
  const other = receiptSignature({ purchaseOrderId: 'po-1', branchId: 'b-1', lines: [{ purchaseOrderLineId: 'l-1', qtyReceived: 3 }] });
  const plan = planAttempt(first, { signature: other, poNumber: 'PO-0007' }, maker());
  assert.equal(plan.kind, 'go');
  assert.notEqual(plan.attempt, first);
  assert.equal(plan.attempt.signature, other);
});

test('asking for something else after the goods were received is held back, so they are not received twice', () => {
  const first = started();
  first.goodsReceiptId = 'grn-1';
  const other = receiptSignature({ purchaseOrderId: 'po-1', branchId: 'b-1', lines: [{ purchaseOrderLineId: 'l-1', qtyReceived: 3 }] });
  const plan = planAttempt(first, { signature: other, poNumber: 'PO-0007' }, maker());
  assert.equal(plan.kind, 'half_done');
  assert.equal(plan.attempt, first);
  assert.match(HALF_DONE_WORDS, /already received/);
  // The same thing as before is still a repeat, and finishes the invoice.
  assert.equal(planAttempt(first, { signature: sig, poNumber: 'PO-0007' }, maker()).kind, 'go');
});

test('what a receipt is does not depend on the order of its lines, and does depend on the order, the branch and the amounts', () => {
  const same = receiptSignature({ purchaseOrderId: 'po-1', branchId: 'b-1', lines: [...lines].reverse() });
  assert.equal(same, sig);
  assert.notEqual(receiptSignature({ purchaseOrderId: 'po-2', branchId: 'b-1', lines }), sig);
  assert.notEqual(receiptSignature({ purchaseOrderId: 'po-1', branchId: 'b-2', lines }), sig);
  assert.notEqual(receiptSignature({ purchaseOrderId: 'po-1', branchId: 'b-1', lines: [{ ...lines[0]!, qtyReceived: 5 }, lines[1]!] }), sig);
});

test('both steps go out once with their own keys, the invoice after the receipt and for the receipt the server made', async () => {
  const attempt = started();
  const { t, receipts, invoices } = tools();
  await sendAttempt(attempt, t);
  assert.deepEqual(receipts, ['key-1']);
  assert.deepEqual(invoices, [{ id: 'grn-1', key: 'key-2' }]);
  assert.equal(attempt.goodsReceiptId, 'grn-1');
});

test('when the invoice fails, trying again sends only the invoice, with the same key, and the goods receipt is never sent twice', async () => {
  const attempt = started();
  const down = tools({
    invoice: async (_id, _key, call) => {
      if (call === 1) throw new Error('timeout');
      return {};
    },
  });
  await assert.rejects(sendAttempt(attempt, down.t), /timeout/);
  assert.equal(attempt.goodsReceiptId, 'grn-1', 'the receipt is known, so it is not asked for again');
  await sendAttempt(attempt, down.t);
  assert.deepEqual(down.receipts, ['key-1'], 'one goods receipt only');
  assert.deepEqual(down.invoices, [
    { id: 'grn-1', key: 'key-2' },
    { id: 'grn-1', key: 'key-2' },
  ]);
});

test('when the goods receipt gets no answer, trying again sends it with the SAME key, so the server returns the first one if it was made', async () => {
  const attempt = started();
  const flaky = tools({
    receipt: async (_key, call) => {
      if (call === 1) throw new Error('timeout');
      return { goodsReceiptId: 'grn-1' };
    },
  });
  await assert.rejects(sendAttempt(attempt, flaky.t), /timeout/);
  assert.equal(attempt.goodsReceiptId, null);
  await sendAttempt(attempt, flaky.t);
  assert.deepEqual(flaky.receipts, ['key-1', 'key-1']);
  assert.equal(flaky.invoices.length, 1);
});

test('an answer that does not say which receipt was made is not built on, and the invoice is not sent for "undefined"', async () => {
  for (const answer of [{}, { goodsReceiptId: '' }, { goodsReceiptId: '   ' }, { goodsReceiptId: 5 }, null]) {
    const attempt = started();
    const odd = tools({ receipt: async () => answer as unknown as { goodsReceiptId: string } });
    await assert.rejects(sendAttempt(attempt, odd.t), /did not say which receipt/, JSON.stringify(answer));
    assert.equal(attempt.goodsReceiptId, null);
    assert.equal(odd.invoices.length, 0);
  }
});

test('the words after a failure say whether the goods are already in, and that pressing again will not count them twice', () => {
  const received = receiptFailureWords({ goodsReceiptId: 'grn-1' }, new Error('Server error'));
  assert.match(received, /goods are recorded as received/);
  assert.match(received, /invoice could not be saved: Server error/);
  assert.match(received, /will not be counted twice/);
  const notYet = receiptFailureWords({ goodsReceiptId: null }, new Error('Network request failed'));
  assert.match(notYet, /^Network request failed Press Confirm receipt again/);
  assert.match(notYet, /will not be counted twice/);
  assert.match(receiptFailureWords({ goodsReceiptId: null }, 'weird'), /^Could not confirm the order\./);
});
