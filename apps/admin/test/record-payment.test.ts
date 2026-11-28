import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '@kiosk/core';
import type { PaymentBody } from '../src/lib/credit';
import { judgePayment, recordPayment, type PaymentInput, type PaymentTools } from '../src/lib/record-payment';

type Read = number | null | 'throw';

/** Tools whose reads follow a script (the last entry repeats), and that remember every payment that was sent. */
function fake(reads: Read[], send: (body: PaymentBody) => Promise<{ claimId?: string | null; balanceCents: number | null }> = async () => ({ balanceCents: null })) {
  const sent: PaymentBody[] = [];
  let read = 0;
  const tools: PaymentTools = {
    readOwed: async () => {
      const next = reads[Math.min(read, reads.length - 1)];
      read += 1;
      if (next === 'throw') throw new Error('offline');
      return next ?? null;
    },
    send: async (body) => {
      sent.push(body);
      const answer = await send(body);
      // The server names the claim it made for every payment it takes; a test says `claimId: null` for an answer that has none.
      return { claimId: answer.claimId === undefined ? 'claim-1' : answer.claimId, balanceCents: answer.balanceCents };
    },
  };
  return { tools, sent, readCount: () => read };
}

const input: PaymentInput = { customerId: 'c-1', name: 'Wanjiku', typed: '500', channel: 'cash', reference: '' };
const fail = (status: number, extra: { foreign?: boolean; hint?: string } = {}, message = 'x') => new ApiError(message, { status, ...extra });

test('a payment is checked against the tab as it stands now, sent once, and the new balance is said', async () => {
  const { tools, sent } = fake([125_000], async () => ({ balanceCents: 75_000 }));
  const outcome = await recordPayment(tools, input);
  assert.deepEqual(outcome, { kind: 'recorded', words: 'Recorded: KES 500.00 paid. Wanjiku now owes KES 750.00.' });
  assert.deepEqual(sent, [{ customerId: 'c-1', amount: 500, channel: 'cash' }]);
});

test('when the server does not say the new balance the tab is read again for it, and when that fails the payment is still said to be recorded', async () => {
  const again = fake([125_000, 75_000]);
  assert.deepEqual(await recordPayment(again.tools, input), { kind: 'recorded', words: 'Recorded: KES 500.00 paid. Wanjiku now owes KES 750.00.' });
  assert.equal(again.sent.length, 1);
  assert.equal(again.readCount(), 2);
  const blind = fake([125_000, 'throw']);
  assert.deepEqual(await recordPayment(blind.tools, input), { kind: 'recorded', words: 'Recorded: KES 500.00 paid by Wanjiku.' });
  assert.equal(blind.sent.length, 1);
});

test('nothing is sent when the tab cannot be read', async () => {
  for (const reads of [['throw'], [null]] as Read[][]) {
    const { tools, sent } = fake(reads);
    const outcome = await recordPayment(tools, input);
    assert.equal(outcome.kind, 'not_sent');
    assert.match(outcome.words, /Could not check what they owe/);
    assert.match(outcome.words, /nothing was recorded/);
    assert.equal(sent.length, 0);
  }
});

test('nothing is sent when the tab is already clear', async () => {
  const { tools, sent } = fake([0]);
  const outcome = await recordPayment(tools, input);
  assert.deepEqual(outcome, { kind: 'not_sent', tone: 'warn', words: 'Wanjiku owes nothing now, so there is nothing to record. Nothing was recorded.' });
  assert.equal(sent.length, 0);
});

test('nothing is sent for more than the tab is now, even when the list said it was more', async () => {
  const { tools, sent } = fake([30_000]);
  const outcome = await recordPayment(tools, input);
  assert.equal(outcome.kind, 'not_sent');
  assert.match(outcome.words, /This tab is only KES 300\.00/);
  assert.match(outcome.words, /Nothing was recorded\.$/);
  assert.equal(sent.length, 0);
});

test('the whole tab can be paid, and one cent more cannot', async () => {
  const whole = fake([125_050], async () => ({ balanceCents: 0 }));
  assert.equal((await recordPayment(whole.tools, { ...input, typed: '1250.50' })).kind, 'recorded');
  assert.deepEqual(whole.sent, [{ customerId: 'c-1', amount: 1250.5, channel: 'cash' }]);
  const over = fake([125_050]);
  assert.equal((await recordPayment(over.tools, { ...input, typed: '1250.51' })).kind, 'not_sent');
  assert.equal(over.sent.length, 0);
});

test('an amount that is not an amount is never sent', async () => {
  for (const typed of ['', '   ', 'abc', '0', '0.00', '-5', '1,5', '1e3', '5.555', '500 KES']) {
    const { tools, sent } = fake([125_000]);
    const outcome = await recordPayment(tools, { ...input, typed });
    assert.equal(outcome.kind, 'not_sent', JSON.stringify(typed));
    assert.equal(sent.length, 0, JSON.stringify(typed));
  }
});

test('an M-Pesa code goes with M-Pesa and with nothing else', async () => {
  const mpesa = fake([125_000]);
  await recordPayment(mpesa.tools, { ...input, channel: 'mpesa', reference: ' QK12345678 ' });
  assert.deepEqual(mpesa.sent, [{ customerId: 'c-1', amount: 500, channel: 'mpesa', reference: 'QK12345678' }]);
  const cash = fake([125_000]);
  await recordPayment(cash.tools, { ...input, channel: 'cash', reference: 'QK12345678' });
  assert.deepEqual(cash.sent, [{ customerId: 'c-1', amount: 500, channel: 'cash' }]);
});

test('a payment the server turns down says so, is not read back and is not sent again', async () => {
  const refused = fake([125_000], async () => {
    throw fail(400, { hint: 'Payment exceeds balance' });
  });
  assert.deepEqual(await recordPayment(refused.tools, input), { kind: 'refused', words: 'Not recorded. Payment exceeds balance' });
  assert.equal(refused.sent.length, 1);
  assert.equal(refused.readCount(), 1);
  const forbidden = fake([125_000], async () => {
    throw fail(403);
  });
  assert.deepEqual(await recordPayment(forbidden.tools, input), {
    kind: 'refused',
    words: 'Not recorded. Your role is not allowed to record payments. Ask the owner of the shop to allow it.',
  });
  const gone = fake([125_000], async () => {
    throw fail(404);
  });
  assert.equal((await recordPayment(gone.tools, input)).kind, 'refused');
});

const NO_ANSWER: [string, () => Error][] = [
  ['a request that timed out', () => new Error('timeout')],
  ['a server error', () => fail(500)],
  ['a bad gateway', () => fail(502)],
  ['an expired sign-in', () => fail(401)],
  ['too many requests', () => fail(429)],
  ['a request timeout answer', () => fail(408)],
  ['a locked answer', () => fail(423)],
  ['a hotel sign-in page', () => fail(403, { foreign: true })],
];

for (const [label, error] of NO_ANSWER) {
  test(`a payment that got ${label} is settled by the tab, and is sent only once`, async () => {
    const send = async (): Promise<{ balanceCents: number | null }> => {
      throw error();
    };

    const through = fake([125_000, 75_000], send);
    const recorded = await recordPayment(through.tools, input);
    assert.equal(recorded.kind, 'recorded');
    assert.match(recorded.words, /They now owe KES 750\.00/);

    const missing = fake([125_000, 125_000], send);
    const notSeen = await recordPayment(missing.tools, input);
    assert.deepEqual(
      { kind: notSeen.kind, verdict: notSeen.kind === 'unsettled' ? notSeen.verdict : null, before: notSeen.kind === 'unsettled' ? notSeen.owedBeforeCents : null, paid: notSeen.kind === 'unsettled' ? notSeen.paidCents : null },
      { kind: 'unsettled', verdict: 'not_seen', before: 125_000, paid: 50_000 }
    );
    assert.match(notSeen.words, /does not show on the tab yet/);

    const moved = fake([125_000, 100_000], send);
    const changed = await recordPayment(moved.tools, input);
    assert.equal(changed.kind === 'unsettled' ? changed.verdict : null, 'changed');

    const blind = fake([125_000, 'throw'], send);
    const unknown = await recordPayment(blind.tools, input);
    assert.equal(unknown.kind === 'unsettled' ? unknown.verdict : null, 'unknown');

    for (const run of [through, missing, moved, blind]) assert.equal(run.sent.length, 1, 'the payment is never sent a second time');
  });
}

test('the owner can check again as often as they like, and checking never sends anything', async () => {
  const { tools, sent } = fake([125_000, 125_000, 125_000, 75_000]);
  const base = { owedBeforeCents: 125_000, paidCents: 50_000 };
  const first = await judgePayment(tools, base);
  const second = await judgePayment(tools, base);
  assert.equal(first.kind, 'unsettled');
  assert.equal(second.kind, 'unsettled');
  assert.deepEqual(await judgePayment(tools, base), { kind: 'unsettled', verdict: 'not_seen', words: first.words, owedBeforeCents: 125_000, paidCents: 50_000 });
  const settled = await judgePayment(tools, base);
  assert.deepEqual(settled, { kind: 'recorded', words: 'Recorded: KES 500.00 paid. They now owe KES 750.00.' });
  assert.equal(sent.length, 0);
});

test('a payment of the whole tab that got no answer is proved by a tab that is now clear', async () => {
  const { tools } = fake([0]);
  const outcome = await judgePayment(tools, { owedBeforeCents: 125_000, paidCents: 125_000 });
  assert.deepEqual(outcome, { kind: 'recorded', words: 'Recorded: KES 1,250.00 paid. They now owe KES 0.00.' });
});

test('an answer without the claim the server makes is not taken for the server\'s: the tab is read, and it is said to be recorded only when it fell', async () => {
  const fell = fake([125_000, 75_000], async () => ({ claimId: null, balanceCents: null }));
  assert.deepEqual(await recordPayment(fell.tools, input), { kind: 'recorded', words: 'Recorded: KES 500.00 paid. They now owe KES 750.00.' });
  assert.equal(fell.sent.length, 1, 'sent once');
  // Even a balance in such an answer is not believed: the read of the tab decides.
  const same = fake([125_000, 125_000], async () => ({ claimId: null, balanceCents: 75_000 }));
  const outcome = await recordPayment(same.tools, input);
  assert.equal(outcome.kind, 'unsettled');
  assert.equal(outcome.kind === 'unsettled' ? outcome.verdict : null, 'not_seen');
  assert.equal(same.sent.length, 1, 'sent once');
  // And when the tab cannot be read either, nothing is claimed.
  const blind = fake([125_000, 'throw'], async () => ({ claimId: null, balanceCents: null }));
  const unknown = await recordPayment(blind.tools, input);
  assert.equal(unknown.kind === 'unsettled' ? unknown.verdict : null, 'unknown');
  assert.equal(blind.sent.length, 1, 'sent once');
});
