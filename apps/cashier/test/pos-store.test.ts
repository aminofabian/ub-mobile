import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { CartLine } from '../src/lib/cart';
import { cartOwnerKey } from '../src/lib/cart-owner';
import { basketsOf, emptyBook, MAX_HELD } from '../src/lib/holds';
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
  assert.equal(basketsOf(usePosStore.getState().holds, WHO, NOON).length, 1);
  const recalled = usePosStore.getState().recallHold('h-1', WHO, NOON, 'h-2');
  assert.deepEqual(usePosStore.getState().cart, before);
  assert.equal(recalled?.parked, null);
  assert.equal(basketsOf(usePosStore.getState().holds, WHO, NOON).length, 0);
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
  assert.deepEqual(basketsOf(usePosStore.getState().holds, WHO, NOON).map((b) => b.id), ['h-2']);
});

test("someone else's basket cannot be picked up or thrown away", () => {
  usePosStore.getState().addToCart(MILK);
  usePosStore.getState().holdCurrent(WHO, NOON, 'h-1');
  assert.equal(usePosStore.getState().recallHold('h-1', OTHER, NOON, 'h-2'), null);
  usePosStore.getState().discardHold('h-1', OTHER);
  assert.equal(basketsOf(usePosStore.getState().holds, WHO, NOON).length, 1);
  usePosStore.getState().discardHold('h-1', WHO);
  assert.equal(basketsOf(usePosStore.getState().holds, WHO, NOON).length, 0);
});

test('held baskets are stored data: signing out, or another person taking the till, does not clear them', () => {
  const pos = usePosStore.getState();
  pos.claim(WANJIKU);
  pos.addToCart(MILK);
  pos.holdCurrent(WHO, NOON, 'h-1');
  usePosStore.getState().release();
  assert.equal(basketsOf(usePosStore.getState().holds, WHO, NOON).length, 1, 'still there after signing out');
  usePosStore.getState().claim(OTIENO);
  assert.equal(basketsOf(usePosStore.getState().holds, WHO, NOON).length, 1, 'still there for the person who held it');
  assert.equal(basketsOf(usePosStore.getState().holds, OTHER, NOON).length, 0, 'and not for anyone else');
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

test('a basket that cannot be held stays in front of the cashier, and the holds stay as they were', () => {
  usePosStore.getState().claim(WANJIKU);
  usePosStore.getState().addToCart(MILK);
  for (let i = 0; i < MAX_HELD; i += 1) {
    assert.equal(usePosStore.getState().holdCurrent(WHO, NOON, `h-${i}`).ok, true);
    usePosStore.getState().addToCart(MILK);
  }
  const holdsBefore = usePosStore.getState().holds;
  const cartBefore = usePosStore.getState().cart;
  assert.equal(cartBefore.length, 1);
  assert.deepEqual(usePosStore.getState().holdCurrent(WHO, NOON, 'h-extra'), { ok: false, reason: 'full' });
  assert.deepEqual(usePosStore.getState().cart, cartBefore);
  assert.deepEqual(usePosStore.getState().holds, holdsBefore);
});

test('a basket that cannot be picked up changes nothing: not the basket in front, not the holds', () => {
  usePosStore.getState().claim(WANJIKU);
  usePosStore.getState().addToCart(MILK);
  usePosStore.getState().holdCurrent(WHO, NOON, 'h-1');
  usePosStore.getState().addToCart(MILK);
  usePosStore.getState().addToCart(MILK);
  const cartBefore = usePosStore.getState().cart;
  const holdsBefore = usePosStore.getState().holds;
  assert.equal(usePosStore.getState().recallHold('no-such-basket', WHO, NOON, 'h-2'), null);
  assert.deepEqual(usePosStore.getState().cart, cartBefore);
  assert.deepEqual(usePosStore.getState().holds, holdsBefore);
  assert.equal(usePosStore.getState().recallHold('h-1', OTHER, NOON, 'h-3'), null);
  assert.deepEqual(usePosStore.getState().cart, cartBefore);
});

test('a weight, a price or a count the till refuses leaves the basket as it was', () => {
  usePosStore.getState().addWeighed(BEEF, 1250);
  usePosStore.getState().addToCart(MILK);
  const before = usePosStore.getState().cart;
  assert.equal(usePosStore.getState().reweigh('i-beef', 0), false);
  assert.equal(usePosStore.getState().reweigh('i-beef', 12.5), false);
  assert.equal(usePosStore.getState().reweigh('i-1', 500), false, 'a counted line is not weighed');
  assert.equal(usePosStore.getState().reweigh('i-nothing', 500), false);
  assert.equal(usePosStore.getState().changePrice('i-beef', 0), false);
  assert.equal(usePosStore.getState().changePrice('i-nothing', 500), false);
  usePosStore.getState().updateQuantity('i-beef', 3);
  usePosStore.getState().updateQuantity('i-1', 1.5);
  assert.deepEqual(usePosStore.getState().cart, before);
});

test('prices set by hand are put back to the shelf price, and the rest of the basket is not touched', () => {
  const pos = usePosStore.getState();
  pos.claim('shop|b-1|u-1');
  assert.equal(pos.addToCart({ id: 'i-milk', name: 'Milk', sellingPrice: 65 }), true);
  assert.equal(pos.addWeighed({ id: 'i-beef', name: 'Beef', sellingPrice: 450, weighed: true, unitType: 'kg' }, 1250), true);
  assert.equal(pos.changePrice('i-milk', 5000), true);
  pos.putBackShelfPrices();
  const cart = usePosStore.getState().cart;
  assert.equal(cart.find((line) => line.itemId === 'i-milk')?.unitPrice, 65);
  assert.equal(cart.find((line) => line.itemId === 'i-milk')?.shelfPrice, undefined);
  assert.equal(cart.find((line) => line.itemId === 'i-beef')?.quantity, 1.25);
});

test('a price taken from the phone\'s list is marked with how old the list was, and the mark follows its line', () => {
  usePosStore.getState().claim(WANJIKU);
  const pos = () => usePosStore.getState();
  assert.equal(pos().addToCart(MILK, NOON), true);
  assert.deepEqual(pos().phoneAsOf, { 'i-1': NOON });
  assert.equal(pos().addToCart(MILK, NOON + 5_000), true);
  assert.deepEqual(pos().phoneAsOf, { 'i-1': NOON }, 'a second unit keeps the price it was rung at, and so its mark');
  assert.equal(pos().addWeighed(BEEF, 500, NOON - 1_000), true);
  assert.deepEqual(pos().phoneAsOf, { 'i-1': NOON, 'i-beef': NOON - 1_000 });
  pos().updateQuantity('i-1', 0);
  assert.deepEqual(pos().phoneAsOf, { 'i-beef': NOON - 1_000 }, 'a line taken out by its count takes its mark with it');
  pos().removeFromCart('i-beef');
  assert.deepEqual(pos().phoneAsOf, {});
});

test('a price the shop itself gave is never marked, and a line that is added again from the shop stays as it was', () => {
  usePosStore.getState().claim(WANJIKU);
  const pos = () => usePosStore.getState();
  pos().addToCart(MILK);
  assert.deepEqual(pos().phoneAsOf, {});
  pos().addToCart(MILK, NOON);
  assert.deepEqual(pos().phoneAsOf, {}, 'the line was priced by the shop; one more unit does not make it the phone\'s');
  assert.equal(pos().addToCart({ ...MILK, sellingPrice: 0 }, NOON), false);
  assert.deepEqual(pos().phoneAsOf, {}, 'an item that could not be added leaves no mark');
});

test('the marks go when the basket does: sold, put on hold, brought back, replaced, or left behind by a person', () => {
  const pos = () => usePosStore.getState();
  pos().claim(WANJIKU);
  pos().addToCart(MILK, NOON);
  pos().clearCart();
  assert.deepEqual(pos().phoneAsOf, {}, 'a sale that is over');

  pos().addToCart(MILK, NOON);
  const held = pos().holdCurrent(WHO, NOON, 'hold-1');
  assert.equal(held.ok, true);
  assert.deepEqual(pos().phoneAsOf, {}, 'a basket put on hold');
  pos().addWeighed(BEEF, 250, NOON);
  const recalled = pos().recallHold('hold-1', WHO, NOON + 1_000, 'parked-1');
  assert.ok(recalled);
  assert.deepEqual(pos().phoneAsOf, {}, 'a basket brought back has been checked with the shop, or said it could not be');

  // A line that is new to the basket (the recalled basket has milk already) so that there is a mark to lose.
  const TEA = { id: 'i-tea', name: 'Tea', sellingPrice: 10 };
  pos().addToCart(TEA, NOON);
  assert.deepEqual(pos().phoneAsOf, { 'i-tea': NOON });
  pos().replaceCart([{ itemId: 'i-9', name: 'Tea', quantity: 1, unitPrice: 10 }]);
  assert.deepEqual(pos().phoneAsOf, {}, 'a basket that is put in front of the cashier');

  pos().addToCart(MILK, NOON);
  pos().release();
  assert.deepEqual(pos().phoneAsOf, {}, 'a person who leaves on purpose');
  pos().claim(WANJIKU);
  pos().addToCart(MILK, NOON);
  pos().claim(OTIENO);
  assert.deepEqual(pos().phoneAsOf, {}, 'a person who takes the till over from someone else');
});

const SERVICE_LINE: CartLine = {
  itemId: 'svc:s-cut:p-1::30000',
  name: 'Haircut',
  quantity: 1,
  unitPrice: 300,
  service: { serviceId: 's-cut', performerId: 'p-1', performerName: 'Wanjiku', optionIds: [] },
};

test('a service goes in the basket, and the same one again makes it two', () => {
  assert.equal(usePosStore.getState().addServiceLine(SERVICE_LINE), true);
  assert.equal(usePosStore.getState().addServiceLine({ ...SERVICE_LINE, quantity: 2 }), true);
  const pos = usePosStore.getState();
  assert.equal(pos.cart.length, 1);
  assert.equal(pos.cart[0]?.quantity, 3);
  assert.equal(pos.addServiceLine({ itemId: 'i-1', name: 'Milk', quantity: 1, unitPrice: 65 }), false, 'a product is not a service');
  assert.equal(usePosStore.getState().cart.length, 1);
});

test('what the shop listed as services stays with the person at the till, and goes when someone else takes it', () => {
  const pos = usePosStore.getState();
  pos.claim(WANJIKU);
  pos.setServiceBook({ tenantId: 'tenant-1', services: [], performers: [], asOf: NOON });
  usePosStore.getState().addServiceLine(SERVICE_LINE);
  usePosStore.getState().claim(WANJIKU);
  assert.notEqual(usePosStore.getState().serviceBook, null, 'the same person keeps it');
  usePosStore.getState().claim(OTIENO);
  assert.equal(usePosStore.getState().serviceBook, null);
  assert.deepEqual(usePosStore.getState().cart, []);
});

test('signing out lets go of the services too', () => {
  usePosStore.getState().setServiceBook({ tenantId: 'tenant-1', services: [], performers: [], asOf: NOON });
  usePosStore.getState().addServiceLine(SERVICE_LINE);
  usePosStore.getState().release();
  assert.equal(usePosStore.getState().serviceBook, null);
});
