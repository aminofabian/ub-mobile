import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISCARD_NEEDS_MANAGER, mayClearLog, mayDiscard } from '../src/lib/discard-rules';
import { PERMISSION } from '../src/lib/shop-flags';

const cash = { body: { payments: [{ method: 'cash', amount: 10 }] } };
const mpesa = { body: { payments: [{ method: 'cash', amount: 5 }, { method: 'mpesa_manual', amount: 5, reference: 'SHK7Y2ABCD' }] } };

test('any cashier may throw away a sale with no M-Pesa money in it', () => {
  assert.equal(mayDiscard(cash, []), true);
  assert.equal(mayDiscard({}, []), true);
  assert.equal(mayDiscard({ body: { payments: 'nope' } }, []), true);
});

test('a sale with M-Pesa money in it is thrown away only by a person who may void any sale', () => {
  assert.equal(mayDiscard(mpesa, []), false);
  assert.equal(mayDiscard(mpesa, ['sales.sell', 'pricing.sell_price.set']), false);
  assert.equal(mayDiscard(mpesa, [PERMISSION.voidAny]), true);
  assert.equal(mayDiscard({ body: { payments: [{ method: 'mpesa', amount: 5 }] } }, []), false);
  assert.equal(PERMISSION.voidAny, 'sales.void.any');
  assert.match(DISCARD_NEEDS_MANAGER, /manager/);
});

test('the till\'s log is cleared by the same kind of person', () => {
  assert.equal(mayClearLog([]), false);
  assert.equal(mayClearLog(['sales.sell']), false);
  assert.equal(mayClearLog([PERMISSION.voidAny]), true);
});
