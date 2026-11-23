import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCash, sharesFor, type PayInputs } from '../src/lib/pay-inputs';
import { planPayments } from '../src/lib/tender';

const CODE = 'SHK7Y2ABCD';
const inputs = (over: Partial<PayInputs>): PayInputs => ({
  mode: 'cash',
  totalCents: 45050,
  handedText: '',
  mpesaText: '',
  code: '',
  ...over,
});

function shares(over: Partial<PayInputs>) {
  const result = sharesFor(inputs(over));
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error('unreachable');
  return result;
}

function refusal(over: Partial<PayInputs>): string {
  const result = sharesFor(inputs(over));
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error('unreachable');
  return result.message;
}

test('cash takes the whole bill, exactly, when nothing is typed', () => {
  const result = shares({ mode: 'cash' });
  assert.deepEqual(result.tenders, [{ kind: 'cash', cents: 45050 }]);
  assert.equal(result.cashCents, 45050);
  assert.equal(result.mpesaCents, 0);
});

test('cash with notes handed over carries them for the change', () => {
  const result = shares({ mode: 'cash', handedText: '1,000' });
  assert.deepEqual(result.tenders, [{ kind: 'cash', cents: 45050, handedCents: 100000 }]);
});

test('notes that are not an amount are refused where the customer pays cash', () => {
  for (const mode of ['cash', 'split'] as const) {
    assert.match(refusal({ mode, handedText: '12,50', mpesaText: '100' }), /cash handed over/);
  }
});

test('what is left in the cash box is not read for credit or M-Pesa, where that box is hidden', () => {
  for (const mode of ['credit', 'mpesa'] as const) {
    const result = shares({ mode, handedText: '12,50', mpesaText: '100', code: CODE });
    assert.equal(result.ok, true, mode);
  }
  // And it changes nothing in what they take.
  assert.deepEqual(shares({ mode: 'credit', handedText: 'abc' }).tenders, [{ kind: 'credit', cents: 45050 }]);
  assert.deepEqual(shares({ mode: 'mpesa', handedText: 'abc', code: CODE }).tenders, [
    { kind: 'mpesa', cents: 45000, code: CODE },
    { kind: 'cash', cents: 50 },
  ]);
});

test('credit takes the whole bill', () => {
  assert.deepEqual(shares({ mode: 'credit' }).tenders, [{ kind: 'credit', cents: 45050 }]);
});

test('M-Pesa takes whole shillings and the cents are taken in cash', () => {
  const result = shares({ mode: 'mpesa', code: CODE });
  assert.deepEqual(result.tenders, [
    { kind: 'mpesa', cents: 45000, code: CODE },
    { kind: 'cash', cents: 50 },
  ]);
  assert.equal(result.mpesaCents, 45000);
  assert.equal(result.cashCents, 50);
});

test('M-Pesa for a bill in whole shillings is M-Pesa alone', () => {
  const result = shares({ mode: 'mpesa', totalCents: 45000, code: CODE });
  assert.deepEqual(result.tenders, [{ kind: 'mpesa', cents: 45000, code: CODE }]);
  assert.equal(result.cashCents, 0);
});

test('a bill under a shilling cannot be paid by M-Pesa', () => {
  assert.match(refusal({ mode: 'mpesa', totalCents: 50 }), /whole shillings/);
});

test('a split takes the M-Pesa share as typed and the rest in cash, with the notes for the cash share only', () => {
  const result = shares({ mode: 'split', totalCents: 100000, mpesaText: '600', handedText: '500', code: CODE });
  assert.deepEqual(result.tenders, [
    { kind: 'mpesa', cents: 60000, code: CODE },
    { kind: 'cash', cents: 40000, handedCents: 50000 },
  ]);
  assert.equal(result.mpesaCents, 60000);
  assert.equal(result.cashCents, 40000);
});

test('a split with cents in the bill leaves them to the cash', () => {
  const result = shares({ mode: 'split', totalCents: 100050, mpesaText: '600', code: CODE });
  assert.equal(result.cashCents, 40050);
});

test('a split that does not make sense says why', () => {
  assert.match(refusal({ mode: 'split', totalCents: 100000, mpesaText: '' }), /how much/);
  assert.match(refusal({ mode: 'split', totalCents: 100000, mpesaText: 'abc' }), /how much/);
  assert.match(refusal({ mode: 'split', totalCents: 100000, mpesaText: '0' }), /how much/);
  assert.match(refusal({ mode: 'split', totalCents: 100000, mpesaText: '600.50' }), /whole shillings/);
  assert.match(refusal({ mode: 'split', totalCents: 100000, mpesaText: '1,000' }), /whole bill/);
  assert.match(refusal({ mode: 'split', totalCents: 100000, mpesaText: '1,200' }), /more than the total, 1,000\.00/);
});

test('nothing to pay is refused', () => {
  for (const totalCents of [0, -1, NaN, 1.5]) {
    assert.match(refusal({ totalCents }), /nothing to pay/);
  }
});

test('what the screen works out is something the planner accepts, for every way of paying', () => {
  const cases: Partial<PayInputs>[] = [
    { mode: 'cash', handedText: '500' },
    { mode: 'cash', totalCents: 45000 },
    { mode: 'mpesa', totalCents: 45000, code: CODE },
    { mode: 'mpesa', code: CODE },
    { mode: 'split', totalCents: 100000, mpesaText: '600', handedText: '500', code: CODE },
    { mode: 'split', totalCents: 100000, mpesaText: '1', code: CODE },
  ];
  for (const over of cases) {
    const result = shares(over);
    const plan = planPayments({ totalCents: over.totalCents ?? 45050, tenders: result.tenders });
    assert.equal(plan.ok, true, JSON.stringify([over, plan]));
  }
  const credit = shares({ mode: 'credit' });
  assert.equal(planPayments({ totalCents: 45050, tenders: credit.tenders, customerId: 'c-1' }).ok, true);
});

test('cash handed over is exact, change, short or not an amount', () => {
  assert.deepEqual(checkCash(45050, ''), { kind: 'exact' });
  assert.deepEqual(checkCash(45050, '   '), { kind: 'exact' });
  assert.deepEqual(checkCash(45050, '450.50'), { kind: 'exact' });
  assert.deepEqual(checkCash(45050, '500'), { kind: 'change', cents: 4950 });
  assert.deepEqual(checkCash(45050, '400'), { kind: 'short', cents: 5050 });
  assert.deepEqual(checkCash(45050, 'abc'), { kind: 'invalid' });
  assert.deepEqual(checkCash(45050, '12,50'), { kind: 'invalid' });
});
