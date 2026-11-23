import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cashSuggestions,
  describePlanProblem,
  isMpesaCode,
  mpesaCodeLooksOdd,
  normalizeMpesaCode,
  planPayments,
  wholeShillings,
  type PlanProblem,
  type Tender,
} from '../src/lib/tender';
import { toCents } from '../src/lib/money';

const CODE = 'SHK7Y2ABCD';

function ok(totalCents: number, tenders: Tender[], customerId?: string | null) {
  const plan = planPayments({ totalCents, tenders, customerId });
  assert.equal(plan.ok, true, JSON.stringify(plan));
  if (!plan.ok) throw new Error('unreachable');
  return plan;
}

function refused(totalCents: number, tenders: Tender[], customerId?: string | null) {
  const plan = planPayments({ totalCents, tenders, customerId });
  assert.equal(plan.ok, false, JSON.stringify(plan));
  if (plan.ok) throw new Error('unreachable');
  return plan;
}

test('cash paid exactly is one cash payment, with no notes recorded', () => {
  const plan = ok(45050, [{ kind: 'cash', cents: 45050 }]);
  assert.deepEqual(plan.payments, [{ method: 'cash', amount: 450.5 }]);
  assert.equal(plan.cashReceived, undefined);
  assert.equal(plan.changeCents, 0);
});

test('notes handed over are sent as cashReceived, and the payment itself stays the exact share', () => {
  // Sending 500 as the payment for a 450.50 sale would be an overpayment: with a customer linked it becomes wallet credit.
  const plan = ok(45050, [{ kind: 'cash', cents: 45050, handedCents: 50000 }]);
  assert.deepEqual(plan.payments, [{ method: 'cash', amount: 450.5 }]);
  assert.equal(plan.cashReceived, 500);
  assert.equal(plan.changeCents, 4950);
});

test('cash handed over exactly means no change', () => {
  const plan = ok(45050, [{ kind: 'cash', cents: 45050, handedCents: 45050 }]);
  assert.equal(plan.cashReceived, 450.5);
  assert.equal(plan.changeCents, 0);
});

test('an M-Pesa payment is the tender mpesa_manual with the receipt code, cleaned the way the server keeps it', () => {
  const plan = ok(45000, [{ kind: 'mpesa', cents: 45000, code: ' shk-7y2 abcd ' }]);
  assert.deepEqual(plan.payments, [{ method: 'mpesa_manual', amount: 450, reference: CODE }]);
  assert.equal(plan.cashReceived, undefined);
  for (const payment of plan.payments) assert.notEqual(payment.method, 'mpesa');
});

test('cash and M-Pesa split: each at its exact share, in a fixed order, with the notes for the cash share only', () => {
  const tenders: Tender[] = [
    { kind: 'mpesa', cents: 60000, code: CODE },
    { kind: 'cash', cents: 40000, handedCents: 50000 },
  ];
  const plan = ok(100000, tenders);
  assert.deepEqual(plan.payments, [
    { method: 'cash', amount: 400 },
    { method: 'mpesa_manual', amount: 600, reference: CODE },
  ]);
  assert.equal(plan.cashReceived, 500);
  assert.equal(plan.changeCents, 10000);
  // The same split given the other way round is the same payments.
  assert.deepEqual(ok(100000, [...tenders].reverse()).payments, plan.payments);
});

test('credit needs a customer, and carries no reference', () => {
  assert.equal(refused(5000, [{ kind: 'credit', cents: 5000 }]).problem, 'credit_customer');
  assert.equal(refused(5000, [{ kind: 'credit', cents: 5000 }], null).problem, 'credit_customer');
  assert.equal(refused(5000, [{ kind: 'credit', cents: 5000 }], '').problem, 'credit_customer');
  assert.equal(refused(5000, [{ kind: 'credit', cents: 5000 }], '   ').problem, 'credit_customer');
  const plan = ok(5000, [{ kind: 'credit', cents: 5000 }], 'cust-1');
  assert.deepEqual(plan.payments, [{ method: 'customer_credit', amount: 50 }]);
  assert.equal('reference' in plan.payments[0], false);
});

test('part on credit and part in cash', () => {
  const plan = ok(10000, [{ kind: 'credit', cents: 7000 }, { kind: 'cash', cents: 3000 }], 'cust-1');
  assert.deepEqual(plan.payments, [
    { method: 'cash', amount: 30 },
    { method: 'customer_credit', amount: 70 },
  ]);
});

test('M-Pesa moves whole shillings: cents are taken in cash', () => {
  assert.equal(refused(45050, [{ kind: 'mpesa', cents: 45050, code: CODE }]).problem, 'mpesa_whole');
  assert.equal(refused(45001, [{ kind: 'mpesa', cents: 45001, code: CODE }]).problem, 'mpesa_whole');
  const plan = ok(45050, [{ kind: 'mpesa', cents: 45000, code: CODE }, { kind: 'cash', cents: 50 }]);
  assert.equal(plan.payments.length, 2);
});

test('an M-Pesa payment without a usable code is refused', () => {
  for (const code of ['', '   ', 'abc', '12345', '--- ---', 'A'.repeat(21)]) {
    assert.equal(refused(45000, [{ kind: 'mpesa', cents: 45000, code }]).problem, 'mpesa_code', JSON.stringify(code));
  }
});

test('payments that do not add up to the total are refused, and say by how much', () => {
  const short = refused(10000, [{ kind: 'cash', cents: 9900 }]);
  assert.equal(short.problem, 'short');
  assert.equal(short.cents, 100);
  const over = refused(10000, [{ kind: 'cash', cents: 10050 }]);
  assert.equal(over.problem, 'over');
  assert.equal(over.cents, 50);
  const splitShort = refused(10000, [{ kind: 'mpesa', cents: 6000, code: CODE }, { kind: 'cash', cents: 3900 }]);
  assert.equal(splitShort.problem, 'short');
  assert.equal(splitShort.cents, 100);
  const splitOver = refused(10000, [{ kind: 'mpesa', cents: 6000, code: CODE }, { kind: 'cash', cents: 4100 }]);
  assert.equal(splitOver.problem, 'over');
  assert.equal(splitOver.cents, 100);
});

test('a total that is not a positive whole number of cents is nothing to pay', () => {
  for (const total of [0, -100, NaN, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 2]) {
    assert.equal(refused(total, [{ kind: 'cash', cents: 100 }]).problem, 'no_total', String(total));
  }
});

test('no way of paying, or a bad amount, or the same way twice', () => {
  assert.equal(refused(100, []).problem, 'no_tender');
  for (const cents of [0, -5, 0.5, NaN, Infinity]) {
    assert.equal(refused(100, [{ kind: 'cash', cents }]).problem, 'bad_amount', String(cents));
  }
  assert.equal(
    refused(100, [{ kind: 'cash', cents: 50 }, { kind: 'cash', cents: 50 }]).problem,
    'repeated'
  );
});

test('notes handed over that do not cover the cash to take are refused', () => {
  assert.equal(refused(10000, [{ kind: 'cash', cents: 10000, handedCents: 9900 }]).problem, 'cash_handed_short');
  assert.equal(refused(10000, [{ kind: 'cash', cents: 10000, handedCents: 0 }]).problem, 'cash_handed_short');
  assert.equal(refused(10000, [{ kind: 'cash', cents: 10000, handedCents: NaN }]).problem, 'cash_handed_short');
  assert.equal(refused(10000, [{ kind: 'cash', cents: 10000, handedCents: 10000.5 }]).problem, 'cash_handed_short');
  // On a split, the notes only have to cover the cash share, not the whole bill.
  const plan = ok(10000, [{ kind: 'cash', cents: 4000, handedCents: 4000 }, { kind: 'mpesa', cents: 6000, code: CODE }]);
  assert.equal(plan.cashReceived, 40);
});

test('every amount sent is exactly the cents planned, with no floating-point drift', () => {
  let seed = 12345;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed;
  };
  for (let i = 0; i < 2000; i += 1) {
    const total = 1 + (next() % 5_000_000);
    const mpesa = Math.floor((next() % (total + 1)) / 100) * 100;
    const cash = total - mpesa;
    const tenders: Tender[] = [];
    if (mpesa > 0) tenders.push({ kind: 'mpesa', cents: mpesa, code: CODE });
    if (cash > 0) tenders.push({ kind: 'cash', cents: cash });
    const plan = ok(total, tenders);
    const sent = plan.payments.reduce((sum, payment) => sum + (toCents(payment.amount) ?? NaN), 0);
    assert.equal(sent, total, `${total} = ${mpesa} + ${cash}`);
  }
});

test('M-Pesa codes are cleaned and judged the way the server judges them', () => {
  assert.equal(normalizeMpesaCode(' shk-7y2 abcd '), CODE);
  assert.equal(normalizeMpesaCode('qgh.12_abc!'), 'QGH12ABC');
  assert.equal(isMpesaCode('A'.repeat(5)), false);
  assert.equal(isMpesaCode('A'.repeat(6)), true);
  assert.equal(isMpesaCode('A'.repeat(20)), true);
  assert.equal(isMpesaCode('A'.repeat(21)), false);
  assert.equal(isMpesaCode('---- ----'), false);
  assert.equal(mpesaCodeLooksOdd(CODE), false);
  assert.equal(mpesaCodeLooksOdd('SHK7Y2ABC'), true);
  assert.equal(mpesaCodeLooksOdd('SHK7Y2ABCDE'), true);
});

test('cents cut down to whole shillings', () => {
  assert.equal(wholeShillings(45050), 45000);
  assert.equal(wholeShillings(45000), 45000);
  assert.equal(wholeShillings(99), 0);
  assert.equal(wholeShillings(100), 100);
  assert.equal(wholeShillings(199), 100);
});

test('every problem has a sentence of its own, and the amounts in it are the amounts that are off', () => {
  const problems: PlanProblem[] = [
    'no_total',
    'no_tender',
    'bad_amount',
    'repeated',
    'mpesa_whole',
    'mpesa_code',
    'credit_customer',
    'short',
    'over',
    'cash_handed_short',
  ];
  const sentences = problems.map((problem) => describePlanProblem({ ok: false, problem, cents: 12345 }));
  assert.equal(new Set(sentences).size, problems.length);
  for (const sentence of sentences) assert.ok(sentence.length > 10);
  assert.match(describePlanProblem({ ok: false, problem: 'short', cents: 12345 }), /123\.45/);
  assert.match(describePlanProblem({ ok: false, problem: 'over', cents: 12345 }), /123\.45/);
  assert.doesNotMatch(describePlanProblem({ ok: false, problem: 'short' }), /undefined|NaN/);
  assert.doesNotMatch(describePlanProblem({ ok: false, problem: 'over' }), /undefined|NaN/);
});

test('likely notes: the exact amount, then the next 50, 100, 500 and 1,000', () => {
  assert.deepEqual(cashSuggestions(123700), [123700, 125000, 130000, 150000, 200000]);
  assert.deepEqual(cashSuggestions(5000), [5000, 10000, 50000, 100000]);
  assert.deepEqual(cashSuggestions(100000), [100000]);
  assert.deepEqual(cashSuggestions(100001), [100001, 105000, 110000, 150000, 200000]);
  assert.deepEqual(cashSuggestions(0), []);
  assert.deepEqual(cashSuggestions(-5), []);
  assert.deepEqual(cashSuggestions(NaN), []);
  for (let due = 1; due < 400000; due += 997) {
    const list = cashSuggestions(due);
    assert.equal(list[0], due);
    for (let i = 1; i < list.length; i += 1) assert.ok(list[i] > list[i - 1], `${due}: ${list}`);
  }
});
