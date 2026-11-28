import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { doubtKey, forgetAllDoubts, forgetDoubt, MAX_REMEMBERED, recallDoubt, rememberDoubt, type RememberedDoubt } from '../src/lib/doubt-memory';

const doubt = (over: Partial<RememberedDoubt> = {}): RememberedDoubt => ({
  kind: 'unsettled',
  verdict: 'not_seen',
  words: 'The payment of KES 500.00 does not show on the tab yet.',
  owedBeforeCents: 125_000,
  paidCents: 50_000,
  ...over,
});

beforeEach(() => forgetAllDoubts());

test('a payment that got no answer is remembered for that customer and not for another', () => {
  const key = doubtKey('palmart.kiosk.ke', 'c-1');
  assert.equal(recallDoubt(key), null);
  rememberDoubt(key, doubt());
  assert.deepEqual(recallDoubt(key), doubt());
  assert.equal(recallDoubt(doubtKey('palmart.kiosk.ke', 'c-2')), null);
});

test('the same customer id in another shop is not the same customer, and the shop is matched whatever its case', () => {
  rememberDoubt(doubtKey('palmart.kiosk.ke', 'c-1'), doubt());
  assert.equal(recallDoubt(doubtKey('other.kiosk.ke', 'c-1')), null);
  assert.deepEqual(recallDoubt(doubtKey(' PALMART.kiosk.ke ', ' c-1 ')), doubt());
});

test('what is looked at again replaces what was known, and a settled payment is forgotten', () => {
  const key = doubtKey('palmart.kiosk.ke', 'c-1');
  rememberDoubt(key, doubt({ verdict: 'unknown', words: 'Could not check.' }));
  rememberDoubt(key, doubt({ verdict: 'changed', words: 'The tab moved.' }));
  assert.equal(recallDoubt(key)?.verdict, 'changed');
  forgetDoubt(key);
  assert.equal(recallDoubt(key), null);
  forgetDoubt(key);
  assert.equal(recallDoubt(key), null);
});

test('only the most recent are kept once there are too many, and a customer looked at again counts as the newest', () => {
  const key = (n: number) => doubtKey('palmart.kiosk.ke', `c-${n}`);
  for (let n = 0; n < MAX_REMEMBERED; n += 1) rememberDoubt(key(n), doubt({ paidCents: n + 1 }));
  rememberDoubt(key(0), doubt({ paidCents: 999 }));
  rememberDoubt(key(MAX_REMEMBERED), doubt());
  assert.equal(recallDoubt(key(1)), null, 'the oldest went');
  assert.equal(recallDoubt(key(0))?.paidCents, 999, 'the one looked at again stayed');
  assert.notEqual(recallDoubt(key(MAX_REMEMBERED)), null);
  assert.notEqual(recallDoubt(key(2)), null);
});
