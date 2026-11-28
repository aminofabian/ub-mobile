import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notReadyText, syncNote, totalText } from '../src/lib/basket-copy';
import type { NotOrderable } from '../src/lib/checkout-run';
import type { NotReady } from '../src/lib/basket';

const format = (currency: string, amount: number) => `${currency} ${amount.toFixed(2)}`;

test('the shop\'s total is shown plainly and the phone\'s reckoning is marked', () => {
  assert.equal(totalText({ currency: 'KES', subtotal: 300, isEstimate: false, waiting: false }, format), 'KES 300.00');
  assert.equal(totalText({ currency: 'KES', subtotal: 305, isEstimate: true, waiting: true }, format), '≈ KES 305.00');
});

test('a total that is not known is not shown at all, rather than as nought', () => {
  assert.equal(totalText({ currency: 'KES', subtotal: null, isEstimate: true, waiting: true }, format), null);
  assert.equal(totalText({ currency: 'KES', subtotal: 0, isEstimate: false, waiting: false }, format), 'KES 0.00');
});

test('what the shop would not take is said first, in the singular and the plural', () => {
  assert.equal(syncNote({ waiting: true, offline: true, refused: 1 }), 'The shop could not take 1 item. See below.');
  assert.equal(syncNote({ waiting: false, offline: false, refused: 3 }), 'The shop could not take 3 items. See below.');
});

test('no signal says the basket is safe, and sending says it is being sent; all heard says nothing', () => {
  assert.match(syncNote({ waiting: true, offline: true, refused: 0 }) ?? '', /No signal.*kept on this phone/);
  assert.equal(syncNote({ waiting: true, offline: false, refused: 0 }), 'Updating with the shop…');
  assert.equal(syncNote({ waiting: false, offline: false, refused: 0 }), null);
  assert.equal(syncNote({ waiting: false, offline: true, refused: 0 }), null, 'a signal that was lost with nothing waiting is not news');
});

test('every reason an order cannot be placed has words for a shopper, and none leaks a code', () => {
  const reasons: NotOrderable[] = ['empty', 'waiting', 'refused', 'unpriced', 'no-cart', 'lapsed', 'unreachable'];
  const seen = new Set<string>();
  for (const reason of reasons) {
    const text = notReadyText(reason);
    assert.ok(text.length > 10 && /[.]$/.test(text), reason);
    assert.doesNotMatch(text, /no-cart|lapsed|unpriced|undefined/);
    seen.add(text);
  }
  assert.ok(seen.size >= 6, 'the reasons are told apart');
});

test('a shop that could not be asked is not said to have missed the basket', () => {
  assert.match(notReadyText('unreachable'), /could not reach the shop/);
  assert.doesNotMatch(notReadyText('unreachable'), /has not reached the shop/);
  assert.match(notReadyText('waiting'), /has not reached the shop/);
});
