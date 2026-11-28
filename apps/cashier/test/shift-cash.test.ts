import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REASON_MIN_LENGTH,
  SHOW_EXPECTED_BEFORE_COUNT,
  VARIANCE_TOLERANCE_CENTS,
  NOTE_RECOUNTS,
  describeVariance,
  needsReason,
  parseOpeningFloat,
  planClose,
  recountNote,
  suggestedFloat,
  unsentAtClose,
} from '../src/lib/shift-cash';

test('the opening float has to be typed, even when it is nothing', () => {
  assert.deepEqual(parseOpeningFloat('5,000'), { ok: true, cents: 500000 });
  assert.deepEqual(parseOpeningFloat('5000.50'), { ok: true, cents: 500050 });
  assert.deepEqual(parseOpeningFloat('0'), { ok: true, cents: 0 });
  for (const text of ['', '   ']) {
    const entry = parseOpeningFloat(text);
    assert.equal(entry.ok, false);
    assert.match(entry.ok ? '' : entry.message, /Use 0 if there is none/);
  }
  for (const text of ['abc', '12,50', '-5', '5 000', '1e3']) {
    const entry = parseOpeningFloat(text);
    assert.equal(entry.ok, false, text);
    assert.match(entry.ok ? '' : entry.message, /as an amount/);
  }
});

test('what the last shift counted is offered, not assumed', () => {
  assert.equal(suggestedFloat({ countedClosingCash: 5000 }), 500000);
  assert.equal(suggestedFloat({ countedClosingCash: 5000.5 }), 500050);
  assert.equal(suggestedFloat({ countedClosingCash: 0 }), 0);
  for (const last of [null, undefined, {}, { countedClosingCash: null }, { countedClosingCash: -1 }, { countedClosingCash: NaN }]) {
    assert.equal(suggestedFloat(last as never), null);
  }
});

const close = (over: Partial<Parameters<typeof planClose>[0]> = {}) =>
  planClose({ expected: 12500, countedText: '12,500', takenOutText: '0', reasonText: '', ...over });

test('a count that matches closes, with the count and the cash taken out as the server wants them', () => {
  const plan = close({ takenOutText: '10,000' });
  assert.equal(plan.step, 'ready');
  if (plan.step !== 'ready') return;
  assert.deepEqual(plan.body, { countedClosingCash: 12500, cashTakenOut: 10000 });
  assert.equal(plan.varianceCents, 0);
  assert.equal(plan.leftInTillCents, 250000);
  assert.equal(plan.expectedCents, 1250000);
});

test('the count is never taken from what the till expects: nothing typed is not a count', () => {
  for (const countedText of ['', '  ']) {
    const plan = close({ countedText });
    assert.equal(plan.step, 'invalid');
    assert.match(plan.step === 'invalid' ? plan.message : '', /Count the cash in the drawer/);
  }
  assert.equal(close({ countedText: 'twelve' }).step, 'invalid');
  assert.equal(close({ countedText: '12,50' }).step, 'invalid');
});

test('the cash taken out has to be typed, and cannot be more than was counted', () => {
  for (const text of ['', '   ']) {
    const blank = close({ takenOutText: text });
    assert.equal(blank.step, 'invalid');
    const message = blank.step === 'invalid' ? blank.message : '';
    assert.match(message, /Enter the cash you are taking out of the till\. Use 0 if nothing leaves/);
    assert.doesNotMatch(message, /as an amount/, 'nothing typed is not the same as something that is not an amount');
  }
  const lots = close({ takenOutText: 'lots' });
  assert.equal(lots.step, 'invalid');
  assert.match(lots.step === 'invalid' ? lots.message : '', /Enter the cash taken out as an amount/);
  const over = close({ takenOutText: '12,500.01' });
  assert.equal(over.step, 'invalid');
  assert.match(over.step === 'invalid' ? over.message : '', /more than you counted \(12,500\.00\)/);
  assert.equal(close({ takenOutText: '12,500' }).step, 'ready', 'taking out everything is allowed');
});

test('a till that has not said what it expects cannot be closed against a guess', () => {
  for (const expected of [null, undefined, NaN]) {
    const plan = planClose({ expected: expected as never, countedText: '100', takenOutText: '0', reasonText: '' });
    assert.equal(plan.step, 'invalid');
    assert.match(plan.step === 'invalid' ? plan.message : '', /has not said how much cash it expects/);
  }
});

test('a difference of more than a cent needs a reason, short or over', () => {
  const short = close({ countedText: '12,450' });
  assert.equal(short.step, 'reason');
  assert.equal(short.step === 'reason' ? short.varianceCents : 0, -5000);
  assert.match(short.step === 'reason' ? short.message : '', /^Short by KES 50\.00\. Say why/);
  const over = close({ countedText: '12,512.50' });
  assert.equal(over.step, 'reason');
  assert.match(over.step === 'reason' ? over.message : '', /^Over by KES 12\.50\. Say why/);
  for (const reasonText of ['', ' ', 'ab', '  a ']) {
    assert.equal(close({ countedText: '12,450', reasonText }).step, 'reason', JSON.stringify(reasonText));
  }
});

test('with a reason the shift closes and the reason goes with it', () => {
  const plan = close({ countedText: '12,450', reasonText: '  Gave 50 too much change  ' });
  assert.equal(plan.step, 'ready');
  if (plan.step !== 'ready') return;
  assert.deepEqual(plan.body, { countedClosingCash: 12450, cashTakenOut: 0, varianceReason: 'Gave 50 too much change' });
  assert.equal(REASON_MIN_LENGTH, 3);
});

test('a difference of a cent or less is a match and sends no reason', () => {
  assert.equal(VARIANCE_TOLERANCE_CENTS, 1);
  for (const countedText of ['12,500.01', '12,499.99']) {
    const plan = close({ countedText, reasonText: 'typed anyway' });
    assert.equal(plan.step, 'ready', countedText);
    assert.equal(plan.step === 'ready' ? 'varianceReason' in plan.body : true, false);
  }
  assert.equal(close({ countedText: '12,500.02' }).step, 'reason');
  assert.equal(close({ countedText: '12,499.98' }).step, 'reason');
});

test('amounts that are whole cents never drift, however the shift adds up', () => {
  const plan = planClose({ expected: 0.1 + 0.2, countedText: '0.30', takenOutText: '0', reasonText: '' });
  assert.equal(plan.step, 'ready');
  assert.equal(plan.step === 'ready' ? plan.varianceCents : NaN, 0);
});

test('a difference is described in words', () => {
  assert.equal(describeVariance(0), 'The count matches');
  assert.equal(describeVariance(1), 'The count matches');
  assert.equal(describeVariance(-1), 'The count matches');
  assert.equal(describeVariance(-5000), 'Short by KES 50.00');
  assert.equal(describeVariance(1250), 'Over by KES 12.50');
  assert.equal(describeVariance(-123456), 'Short by KES 1,234.56');
});

test('closing with sales still on the phone is warned about, with how many', () => {
  assert.equal(unsentAtClose(0), null);
  assert.equal(unsentAtClose(-1), null);
  assert.equal(unsentAtClose(NaN), null);
  assert.match(unsentAtClose(1) ?? '', /^1 sale is still on this phone and not sent\./);
  assert.match(unsentAtClose(4) ?? '', /^4 sales are still on this phone and not sent\./);
  assert.match(unsentAtClose(2) ?? '', /recorded in whichever shift is open then, under whoever is signed in then/);
  assert.doesNotMatch(unsentAtClose(2) ?? '', /can no longer take them/, 'the server does not promise that');
});

test('the expected cash is not shown before the count, unless the owner switches that on', () => {
  assert.equal(SHOW_EXPECTED_BEFORE_COUNT, false);
});

test('a difference needs a reason once it is more than the cent the server ignores, on either side', () => {
  for (const cents of [0, 1, -1]) assert.equal(needsReason(cents), false, String(cents));
  for (const cents of [2, -2, 50, -50000]) assert.equal(needsReason(cents), true, String(cents));
  assert.equal(needsReason(VARIANCE_TOLERANCE_CENTS), false);
  assert.equal(needsReason(VARIANCE_TOLERANCE_CENTS + 1), true);
});

test('the reason box stays for as long as the difference needs one, however much of the reason has been typed', () => {
  // The screen shows the box by `needsReason`, not by the step: once three characters are typed the step is "ready".
  const typing = (reasonText: string) => planClose({ expected: 100, countedText: '90', takenOutText: '0', reasonText });
  assert.equal(typing('').step, 'reason');
  assert.equal(typing('sh').step, 'reason');
  const ready = typing('sho');
  assert.equal(ready.step, 'ready');
  assert.equal(ready.step !== 'invalid' && needsReason(ready.varianceCents), true, 'still needs one, so the box must not go');
});

test('a recount after the expected cash was shown is written on the closed shift, and only when the count changed', () => {
  assert.equal(NOTE_RECOUNTS, true);
  assert.equal(recountNote(null, 10000), undefined, 'no first count');
  assert.equal(recountNote(undefined, 10000), undefined);
  assert.equal(recountNote(10000, 10000), undefined, 'counted the same again');
  assert.equal(recountNote(9000, 10000), 'Counted 90.00 first, then 100.00 after seeing the expected cash.');
  const changed = planClose({ expected: 100, countedText: '100', takenOutText: '0', reasonText: '', firstCountedCents: 9000 });
  assert.equal(changed.step === 'ready' && changed.body.notes, 'Counted 90.00 first, then 100.00 after seeing the expected cash.');
  const same = planClose({ expected: 100, countedText: '100', takenOutText: '0', reasonText: '', firstCountedCents: 10000 });
  assert.equal(same.step === 'ready' && 'notes' in same.body, false);
  const none = planClose({ expected: 100, countedText: '100', takenOutText: '0', reasonText: '' });
  assert.equal(none.step === 'ready' && 'notes' in none.body, false);
});

test('the recount note names the first count and the final one, not the expected cash', () => {
  // Expected 100.00, first counted 90.00, then 95.00 after seeing it: still short by 5.00, with a reason.
  const plan = planClose({ expected: 100, countedText: '95', takenOutText: '0', reasonText: 'two coins dropped', firstCountedCents: 9000 });
  assert.equal(plan.step, 'ready');
  assert.equal(plan.step === 'ready' && plan.body.notes, 'Counted 90.00 first, then 95.00 after seeing the expected cash.');
  assert.equal(plan.step === 'ready' && plan.body.varianceReason, 'two coins dropped');
});
