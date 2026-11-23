import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartOwnerKey, keepsCart } from '../src/lib/cart-owner';

const WANJIKU = { shop: 'acme', branchId: 'b-1', userId: 'u-1' };

test('the same person at the same branch of the same shop has the same name every time', () => {
  assert.equal(cartOwnerKey(WANJIKU), cartOwnerKey({ ...WANJIKU }));
});

test('another person, another branch or another shop is another owner', () => {
  const key = cartOwnerKey(WANJIKU);
  assert.notEqual(cartOwnerKey({ ...WANJIKU, userId: 'u-2' }), key);
  assert.notEqual(cartOwnerKey({ ...WANJIKU, branchId: 'b-2' }), key);
  assert.notEqual(cartOwnerKey({ ...WANJIKU, shop: 'bobs' }), key);
});

test('ids that run together the same way do not make two people one', () => {
  // "ab" + "c" and "a" + "bc" are the same text when glued, and must not be the same owner.
  assert.notEqual(
    cartOwnerKey({ shop: 'acme', branchId: 'ab', userId: 'c' }),
    cartOwnerKey({ shop: 'acme', branchId: 'a', userId: 'bc' })
  );
  assert.notEqual(
    cartOwnerKey({ shop: 'a', branchId: 'b|c', userId: 'd' }),
    cartOwnerKey({ shop: 'a|b', branchId: 'c', userId: 'd' })
  );
  assert.notEqual(
    cartOwnerKey({ shop: 'a", "b', branchId: 'c', userId: 'd' }),
    cartOwnerKey({ shop: 'a', branchId: 'b", "c', userId: 'd' })
  );
});

test('a cart is kept only for the person it was held for', () => {
  const mine = cartOwnerKey(WANJIKU);
  assert.equal(keepsCart(mine, mine), true, 'the same person signing back in after the session ran out');
  assert.equal(keepsCart(mine, cartOwnerKey({ ...WANJIKU, userId: 'u-2' })), false, 'the next cashier');
  assert.equal(keepsCart(mine, cartOwnerKey({ ...WANJIKU, branchId: 'b-2' })), false, 'the same person at another branch');
  assert.equal(keepsCart(mine, cartOwnerKey({ ...WANJIKU, shop: 'bobs' })), false, 'another shop');
  assert.equal(keepsCart(null, mine), false, 'nothing held: nothing to keep');
});
