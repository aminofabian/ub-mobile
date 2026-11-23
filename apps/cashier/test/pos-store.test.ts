import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { cartOwnerKey } from '../src/lib/cart-owner';
import { usePosStore } from '../src/store/pos-store';

const WANJIKU = cartOwnerKey({ shop: 'acme', branchId: 'b-1', userId: 'u-1' });
const OTIENO = cartOwnerKey({ shop: 'acme', branchId: 'b-1', userId: 'u-2' });
const WANJIKU_AT_WESTLANDS = cartOwnerKey({ shop: 'acme', branchId: 'b-2', userId: 'u-1' });

const MILK = { id: 'i-1', name: 'Milk 500ml', sellingPrice: 65 };

/** Rings up a sale and leaves the till as a person leaves it mid-shift. */
function ringUp() {
  const pos = usePosStore.getState();
  pos.setItems([MILK]);
  pos.addToCart(MILK);
  pos.addToCart(MILK);
  pos.setShift({ id: 'shift-1', status: 'OPEN' });
  pos.setLastSale({ id: 'sale-0', grandTotal: 130 });
}

beforeEach(() => {
  usePosStore.getState().release();
});

test('a till nobody has held starts empty', () => {
  const pos = usePosStore.getState();
  assert.equal(pos.owner, null);
  assert.deepEqual(pos.cart, []);
  assert.equal(pos.currentShift, null);
  assert.equal(pos.lastSale, null);
  assert.deepEqual(pos.items, []);
});

test('the first person to take the till finds it empty and is its owner', () => {
  usePosStore.getState().claim(WANJIKU);
  assert.equal(usePosStore.getState().owner, WANJIKU);
  assert.deepEqual(usePosStore.getState().cart, []);
});

test('the same person signing back in keeps the sale they were ringing, the shift and the last receipt', () => {
  usePosStore.getState().claim(WANJIKU);
  ringUp();
  usePosStore.getState().claim(WANJIKU);
  const pos = usePosStore.getState();
  assert.equal(pos.cart.length, 1);
  assert.equal(pos.cart[0].quantity, 2);
  assert.equal(pos.currentShift?.id, 'shift-1');
  assert.equal(pos.lastSale?.id, 'sale-0');
  assert.equal(pos.items.length, 1);
});

test('the next cashier does not inherit the cart, the open shift or the last receipt', () => {
  usePosStore.getState().claim(WANJIKU);
  ringUp();
  usePosStore.getState().claim(OTIENO);
  const pos = usePosStore.getState();
  assert.equal(pos.owner, OTIENO);
  assert.deepEqual(pos.cart, []);
  assert.equal(pos.cartTotal(), 0);
  assert.equal(pos.currentShift, null, "someone else's shift is not theirs to see or close");
  assert.equal(pos.lastSale, null, "someone else's customer is not on their receipt screen");
  assert.deepEqual(pos.items, [], 'the list was loaded for the other session and is fetched again');
});

test('the same person at another branch starts clean too', () => {
  usePosStore.getState().claim(WANJIKU);
  ringUp();
  usePosStore.getState().claim(WANJIKU_AT_WESTLANDS);
  assert.deepEqual(usePosStore.getState().cart, []);
  assert.equal(usePosStore.getState().currentShift, null);
  assert.deepEqual(usePosStore.getState().items, []);
});

test('signing out on purpose leaves nothing, even for the same person coming back', () => {
  usePosStore.getState().claim(WANJIKU);
  ringUp();
  usePosStore.getState().release();
  const left = usePosStore.getState();
  assert.equal(left.owner, null);
  assert.deepEqual(left.cart, [], 'nothing is left in memory once the person has gone');
  assert.equal(left.currentShift, null);
  assert.equal(left.lastSale, null);
  assert.deepEqual(left.items, []);
  usePosStore.getState().claim(WANJIKU);
  const pos = usePosStore.getState();
  assert.deepEqual(pos.cart, []);
  assert.equal(pos.currentShift, null);
  assert.equal(pos.lastSale, null);
});

test('the cart still works as before for the person who holds the till', () => {
  const pos = usePosStore.getState();
  pos.claim(WANJIKU);
  pos.addToCart(MILK);
  pos.updateQuantity(MILK.id, 3);
  assert.equal(usePosStore.getState().cartTotal(), 195);
  usePosStore.getState().removeFromCart(MILK.id);
  assert.deepEqual(usePosStore.getState().cart, []);
  usePosStore.getState().addToCart(MILK);
  usePosStore.getState().clearCart();
  assert.deepEqual(usePosStore.getState().cart, []);
  assert.equal(usePosStore.getState().owner, WANJIKU, 'clearing a sale does not give up the till');
});
