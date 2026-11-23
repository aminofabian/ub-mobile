import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { cartOwnerKey } from '../src/lib/cart-owner';
import { basketsOf, emptyBook } from '../src/lib/holds';
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

const BEEF = { id: 'i-beef', name: 'Beef', sellingPrice: 450, weighed: true, unitType: 'kg' };
const FLOUR_IN_GRAMS = { id: 'i-flour', name: 'Flour', sellingPrice: 0.12, weighed: true, unitType: 'g' };
const WHO = { branchId: 'b-1', userId: 'u-1' };
const OTHER = { branchId: 'b-1', userId: 'u-2' };
const NOON = Date.parse('2026-11-23T12:00:00.000Z');

beforeEach(() => {
  usePosStore.getState().release();
  usePosStore.getState().loadHolds(emptyBook(), 'tenant-1');
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

test('an item sold by the unit is added one at a time, and the store says when it could not add', () => {
  const pos = usePosStore.getState();
  assert.equal(pos.addToCart(MILK), true);
  assert.equal(pos.addToCart(BEEF), false, 'a weighed item needs a weight');
  assert.equal(pos.addToCart(FLOUR_IN_GRAMS), false);
  assert.equal(pos.addToCart({ id: 'i-free', name: 'Free', sellingPrice: 0 }), false);
  assert.deepEqual(usePosStore.getState().cart.map((l) => l.itemId), [MILK.id]);
});

test('a weighed item is added by weight, weighed again by replacing, and counted to the cent', () => {
  const pos = usePosStore.getState();
  assert.equal(pos.addWeighed(BEEF, 1250), true);
  assert.equal(usePosStore.getState().cart[0]?.quantity, 1.25);
  assert.equal(usePosStore.getState().cartTotalCents(), 56250);
  assert.equal(usePosStore.getState().cartTotal(), 562.5);
  assert.equal(usePosStore.getState().reweigh('i-beef', 800), true);
  assert.equal(usePosStore.getState().cart[0]?.quantity, 0.8);
  assert.equal(usePosStore.getState().addWeighed(MILK, 500), false, 'a unit item is not weighed');
  assert.equal(usePosStore.getState().addWeighed(BEEF, 0), false);
  usePosStore.getState().updateQuantity('i-beef', 3);
  assert.equal(usePosStore.getState().cart[0]?.quantity, 0.8, 'the + and - of a unit line do not touch a weighed one');
});

test("the cashier's price is kept on the line and the total follows it", () => {
  const pos = usePosStore.getState();
  pos.addWeighed(BEEF, 1000);
  assert.equal(usePosStore.getState().changePrice('i-beef', 40000), true);
  assert.equal(usePosStore.getState().cart[0]?.shelfPrice, 450);
  assert.equal(usePosStore.getState().cartTotalCents(), 40000);
  assert.equal(usePosStore.getState().changePrice('i-beef', 0), false);
  assert.equal(usePosStore.getState().changePrice('i-nothing', 5000), false);
  assert.equal(usePosStore.getState().cartTotalCents(), 40000, 'a refused change leaves the line as it was');
});

test('a total that cannot be counted is not a total', () => {
  usePosStore.getState().replaceCart([{ itemId: 'x', name: 'x', quantity: 1, unitPrice: Number.NaN }]);
  assert.equal(usePosStore.getState().cartTotalCents(), null);
  assert.equal(usePosStore.getState().cartTotal(), 0);
});

test('putting a basket on hold empties the cart, and picking it up brings it back', () => {
  const pos = usePosStore.getState();
  pos.claim(WANJIKU);
  pos.addToCart(MILK);
  pos.addWeighed(BEEF, 500);
  const before = usePosStore.getState().cart;
  const held = usePosStore.getState().holdCurrent(WHO, NOON, 'h-1');
  assert.equal(held.ok, true);
  assert.deepEqual(usePosStore.getState().cart, []);
  assert.equal(basketsOf(usePosStore.getState().holds, WHO).length, 1);
  const recalled = usePosStore.getState().recallHold('h-1', WHO, NOON, 'h-2');
  assert.deepEqual(usePosStore.getState().cart, before);
  assert.equal(recalled?.parked, null);
  assert.equal(basketsOf(usePosStore.getState().holds, WHO).length, 0);
});

test('an empty cart is not held, and nothing changes', () => {
  const result = usePosStore.getState().holdCurrent(WHO, NOON, 'h-1');
  assert.deepEqual(result, { ok: false, reason: 'empty' });
  assert.deepEqual(usePosStore.getState().holds, emptyBook());
});

test('picking a basket up while one is being rung puts the one being rung on hold', () => {
  const pos = usePosStore.getState();
  pos.addToCart(MILK);
  pos.holdCurrent(WHO, NOON, 'h-1');
  usePosStore.getState().addWeighed(BEEF, 500);
  const recalled = usePosStore.getState().recallHold('h-1', WHO, NOON + 1000, 'h-2');
  assert.deepEqual(usePosStore.getState().cart.map((l) => l.itemId), [MILK.id]);
  assert.deepEqual(recalled?.parked?.lines.map((l) => l.itemId), ['i-beef']);
  assert.deepEqual(basketsOf(usePosStore.getState().holds, WHO).map((b) => b.id), ['h-2']);
});

test("someone else's basket cannot be picked up or thrown away", () => {
  usePosStore.getState().addToCart(MILK);
  usePosStore.getState().holdCurrent(WHO, NOON, 'h-1');
  assert.equal(usePosStore.getState().recallHold('h-1', OTHER, NOON, 'h-2'), null);
  usePosStore.getState().discardHold('h-1', OTHER);
  assert.equal(basketsOf(usePosStore.getState().holds, WHO).length, 1);
  usePosStore.getState().discardHold('h-1', WHO);
  assert.equal(basketsOf(usePosStore.getState().holds, WHO).length, 0);
});

test('held baskets are stored data: signing out, or another person taking the till, does not clear them', () => {
  const pos = usePosStore.getState();
  pos.claim(WANJIKU);
  pos.addToCart(MILK);
  pos.holdCurrent(WHO, NOON, 'h-1');
  usePosStore.getState().release();
  assert.equal(basketsOf(usePosStore.getState().holds, WHO).length, 1, 'still there after signing out');
  usePosStore.getState().claim(OTIENO);
  assert.equal(basketsOf(usePosStore.getState().holds, WHO).length, 1, 'still there for the person who held it');
  assert.equal(basketsOf(usePosStore.getState().holds, OTHER).length, 0, 'and not for anyone else');
  assert.equal(usePosStore.getState().holdsFor, 'tenant-1');
});

test('what the shop lets a till do is read again for each person who takes the till', () => {
  const pos = usePosStore.getState();
  pos.claim(WANJIKU);
  pos.setFlags({ 'pos.cashier_price_edit': true });
  usePosStore.getState().claim(WANJIKU);
  assert.deepEqual(usePosStore.getState().flags, { 'pos.cashier_price_edit': true }, 'the same person keeps what was read');
  usePosStore.getState().claim(OTIENO);
  assert.deepEqual(usePosStore.getState().flags, {}, 'the next person starts with none until they are read');
});
