import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addUnit,
  addWeight,
  cannotAdd,
  cartCents,
  lineThousandths,
  lineTotalCents,
  lineWords,
  MAX_UNITS,
  priceChanged,
  removeLine,
  setLinePrice,
  setUnits,
  setWeight,
  type CartItem,
  type CartLine,
} from '../src/lib/cart';
import { MAX_WEIGHT_THOUSANDTHS } from '../src/lib/weight';

const MILK: CartItem = { id: 'i-milk', name: 'Milk 500ml', sellingPrice: 65 };
const BEEF: CartItem = { id: 'i-beef', name: 'Beef', sellingPrice: 450, weighed: true, unitType: 'kg' };
const FLOUR_G: CartItem = { id: 'i-flour', name: 'Flour', sellingPrice: 0.12, weighed: true, unitType: 'g' };
const NO_PRICE: CartItem = { id: 'i-free', name: 'Free sample', sellingPrice: 0 };

function frozen(cart: CartLine[]): CartLine[] {
  return cart.map((line) => Object.freeze({ ...line }));
}

test('tapping an item adds one, and again adds another', () => {
  const one = addUnit([], MILK);
  assert.deepEqual(one, [{ itemId: 'i-milk', name: 'Milk 500ml', quantity: 1, unitPrice: 65 }]);
  const two = addUnit(one ?? [], MILK);
  assert.equal(two?.length, 1);
  assert.equal(two?.[0]?.quantity, 2);
});

test('the basket it was given is never changed', () => {
  const start = frozen(addUnit([], MILK) ?? []);
  const before = JSON.stringify(start);
  const after = addUnit(start, MILK);
  assert.equal(JSON.stringify(start), before);
  assert.notEqual(after, start);
  assert.equal(start[0]?.quantity, 1);
  assert.equal(after?.[0]?.quantity, 2);
  for (const result of [
    addUnit(start, BEEF),
    addWeight(start, BEEF, 500),
    setUnits(start, 'i-milk', 5),
    setLinePrice(start, 'i-milk', 6000),
    removeLine(start, 'i-milk'),
  ]) {
    assert.equal(JSON.stringify(start), before);
    assert.notEqual(result, start);
  }
});

test('a basket keeps its order: a new item goes last, a repeat stays where it was', () => {
  let cart: CartLine[] = [];
  cart = addUnit(cart, MILK) ?? cart;
  cart = addWeight(cart, BEEF, 500) ?? cart;
  cart = addUnit(cart, MILK) ?? cart;
  assert.deepEqual(cart.map((line) => line.itemId), ['i-milk', 'i-beef']);
  assert.equal(cart[0]?.quantity, 2);
});

test('an item sold by weight is not rung up by tapping, and an item sold by the unit is not weighed', () => {
  assert.equal(addUnit([], BEEF), null);
  assert.equal(addWeight([], MILK, 500), null);
});

test('an item the server would refuse never gets into the basket', () => {
  assert.equal(addUnit([], NO_PRICE), null);
  assert.equal(addWeight([], FLOUR_G, 500), null);
  assert.match(cannotAdd(FLOUR_G) ?? '', /kg only/);
  assert.match(cannotAdd(NO_PRICE) ?? '', /no price/);
  assert.equal(cannotAdd({ id: 'x', name: 'x', sellingPrice: Number.NaN }) !== null, true);
  assert.equal(cannotAdd({ id: 'x', name: 'x', sellingPrice: -5 }) !== null, true);
  assert.equal(cannotAdd(MILK), null);
  assert.equal(cannotAdd(BEEF), null);
});

test('a weighing is a line of kilograms priced per kilogram', () => {
  const cart = addWeight([], BEEF, 1250);
  assert.deepEqual(cart, [{ itemId: 'i-beef', name: 'Beef', quantity: 1.25, unitPrice: 450, weighed: true }]);
  assert.equal(lineTotalCents(cart?.[0] as CartLine), 56250);
});

test('weighing the same item again adds to the line, exactly', () => {
  let cart = addWeight([], BEEF, 100) ?? [];
  cart = addWeight(cart, BEEF, 200) ?? [];
  assert.equal(cart.length, 1);
  assert.equal(cart[0]?.quantity, 0.3, '0.1 kg and 0.2 kg make 0.3 kg, not 0.30000000000000004');
  assert.equal(lineThousandths(cart[0] as CartLine), 300);
  cart = addWeight(cart, BEEF, 700) ?? [];
  assert.equal(cart[0]?.quantity, 1);
});

test('a line cannot grow past the most a line may weigh, and says no instead of cutting it short', () => {
  const near = addWeight([], BEEF, MAX_WEIGHT_THOUSANDTHS - 10) ?? [];
  assert.equal(addWeight(near, BEEF, 11), null);
  const full = addWeight(near, BEEF, 10);
  assert.equal(full?.[0]?.quantity, 999.999);
  assert.equal(addWeight([], BEEF, MAX_WEIGHT_THOUSANDTHS + 1), null);
});

test('a weight must be a whole number of grams above zero', () => {
  for (const bad of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(addWeight([], BEEF, bad), null, String(bad));
  }
});

test('weighing a line again replaces the weight', () => {
  const cart = addWeight([], BEEF, 1250) ?? [];
  const again = setWeight(cart, 'i-beef', 800);
  assert.equal(again?.[0]?.quantity, 0.8);
  assert.equal(again?.[0]?.weighed, true);
  assert.equal(setWeight(cart, 'i-beef', 0), null);
  assert.equal(setWeight(cart, 'i-beef', MAX_WEIGHT_THOUSANDTHS + 1), null);
  assert.equal(setWeight(cart, 'i-nothing', 500), null);
  assert.equal(setWeight(addUnit([], MILK) ?? [], 'i-milk', 500), null, 'a line sold by the unit is not weighed');
});

test('units are whole numbers, zero takes the line out, and weighed lines have no units', () => {
  const cart = addUnit([], MILK) ?? [];
  assert.equal(setUnits(cart, 'i-milk', 3)?.[0]?.quantity, 3);
  assert.deepEqual(setUnits(cart, 'i-milk', 0), []);
  assert.deepEqual(setUnits(cart, 'i-milk', -2), []);
  assert.equal(setUnits(cart, 'i-milk', 1.5), null);
  assert.equal(setUnits(cart, 'i-milk', Number.NaN), null);
  assert.equal(setUnits(cart, 'i-milk', MAX_UNITS + 1), null);
  assert.equal(setUnits(cart, 'i-milk', MAX_UNITS)?.[0]?.quantity, MAX_UNITS);
  assert.equal(setUnits(cart, 'i-nothing', 2), null);
  const weighed = addWeight([], BEEF, 500) ?? [];
  assert.equal(setUnits(weighed, 'i-beef', 2), null);
  let full = setUnits(cart, 'i-milk', MAX_UNITS) ?? [];
  assert.equal(addUnit(full, MILK), null, 'one more would pass the most a line can hold');
  full = [];
  assert.equal(full.length, 0);
});

test('a line goes out on its own', () => {
  let cart = addUnit([], MILK) ?? [];
  cart = addWeight(cart, BEEF, 500) ?? [];
  assert.deepEqual(removeLine(cart, 'i-milk').map((line) => line.itemId), ['i-beef']);
  assert.equal(removeLine(cart, 'i-nothing').length, 2);
});

test('the cashier can set their own price, and the shelf price stays visible', () => {
  const cart = addWeight([], BEEF, 1000) ?? [];
  const cheaper = setLinePrice(cart, 'i-beef', 40000) ?? [];
  assert.equal(cheaper[0]?.unitPrice, 400);
  assert.equal(cheaper[0]?.shelfPrice, 450);
  assert.equal(priceChanged(cheaper[0] as CartLine), true);
  assert.equal(lineTotalCents(cheaper[0] as CartLine), 40000);
  const again = setLinePrice(cheaper, 'i-beef', 42000) ?? [];
  assert.equal(again[0]?.shelfPrice, 450, 'the shelf price is the one it came from, not the last one typed');
  assert.equal(again[0]?.unitPrice, 420);
});

test('typing the shelf price again puts the line back on it, with nothing left over', () => {
  const cart = addWeight([], BEEF, 1000) ?? [];
  const changed = setLinePrice(cart, 'i-beef', 40000) ?? [];
  const back = setLinePrice(changed, 'i-beef', 45000) ?? [];
  assert.deepEqual(back, cart);
  assert.equal('shelfPrice' in (back[0] as CartLine), false);
  assert.equal(priceChanged(back[0] as CartLine), false);
  const same = setLinePrice(cart, 'i-beef', 45000) ?? [];
  assert.deepEqual(same, cart, 'typing the shelf price on a line that was never changed changes nothing');
});

test('a shelf price with fractions of a cent goes back exactly', () => {
  const odd: CartItem = { id: 'i-odd', name: 'Odd', sellingPrice: 12.3456 };
  const cart = addUnit([], odd) ?? [];
  const changed = setLinePrice(cart, 'i-odd', 1000) ?? [];
  const back = setLinePrice(changed, 'i-odd', 1235) ?? [];
  assert.equal(back[0]?.unitPrice, 12.3456, 'the shelf price, not the rounded one');
  assert.equal('shelfPrice' in (back[0] as CartLine), false);
});

test('a price must be above zero and the line must be there', () => {
  const cart = addUnit([], MILK) ?? [];
  for (const bad of [0, -100, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2]) {
    assert.equal(setLinePrice(cart, 'i-milk', bad), null, String(bad));
  }
  assert.equal(setLinePrice(cart, 'i-nothing', 5000), null);
});

test('a changed price does not change what the line weighs or how it is sold', () => {
  const cart = addWeight([], BEEF, 750) ?? [];
  const changed = setLinePrice(cart, 'i-beef', 40000) ?? [];
  assert.equal(changed[0]?.quantity, 0.75);
  assert.equal(changed[0]?.weighed, true);
  const back = setLinePrice(changed, 'i-beef', 45000) ?? [];
  assert.equal(back[0]?.weighed, true);
  assert.equal(back[0]?.quantity, 0.75);
});

test('the total counts every line to the cent the way the server does', () => {
  let cart = addUnit([], MILK) ?? [];
  cart = setUnits(cart, 'i-milk', 3) ?? [];
  cart = addWeight(cart, BEEF, 333) ?? [];
  assert.equal(cartCents(cart), 3 * 6500 + 14985);
  assert.equal(cartCents([]), 0);
  assert.equal(cartCents([{ itemId: 'x', name: 'x', quantity: 1, unitPrice: Number.NaN }]), null);
});

test('what a line says on the screen', () => {
  const milk = addUnit([], MILK) ?? [];
  assert.deepEqual(lineWords(setUnits(milk, 'i-milk', 3)?.[0] as CartLine), { quantity: '3', price: '65.00', total: '195.00' });
  const beef = addWeight([], BEEF, 1250) ?? [];
  assert.deepEqual(lineWords(beef[0] as CartLine), { quantity: '1.25 kg', price: '450.00 per kg', total: '562.50' });
  const cheaper = setLinePrice(beef, 'i-beef', 40000) ?? [];
  assert.deepEqual(lineWords(cheaper[0] as CartLine), {
    quantity: '1.25 kg',
    price: '400.00 per kg',
    total: '500.00',
    was: '450.00',
  });
  assert.equal(lineWords({ itemId: 'x', name: 'x', quantity: 1, unitPrice: Number.NaN }).total, '-');
});

test('a weighed line can be weighed again as the item it is, at the price it stands at', async () => {
  const { weighedItemOf, setWeight, addWeight } = await import('../src/lib/cart');
  const beef = { id: 'i-9', name: 'Beef', sellingPrice: 650, weighed: true, unitType: 'kg' };
  const cart = addWeight([], beef, 1250);
  assert.ok(cart);
  const line = cart[0];
  assert.ok(line);
  const again = weighedItemOf({ ...line, unitPrice: 600, shelfPrice: 650 });
  assert.deepEqual(again, { id: 'i-9', name: 'Beef', sellingPrice: 600, weighed: true, unitType: 'kg' });
  assert.ok(addWeight([], again, 500), 'it can be sold by weight');
  assert.ok(setWeight(cart, 'i-9', 500));
});

test('an item now sold by the unit is not added to a line that was weighed', () => {
  const weighed = addWeight([], BEEF, 1250);
  assert.ok(weighed);
  assert.equal(addUnit(weighed, { ...BEEF, weighed: undefined, unitType: undefined }), null);
});

test('one line holds up to the most units, and not one more', () => {
  const base = addUnit([], MILK);
  assert.ok(base);
  const nearly = setUnits(base, 'i-milk', MAX_UNITS - 1);
  assert.ok(nearly);
  const full = addUnit(nearly, MILK);
  assert.equal(full?.[0]?.quantity, MAX_UNITS);
  assert.equal(full ? addUnit(full, MILK) : 'no line', null);
});

test('a price remembered as the shelf price but equal to it in cents is not a change', () => {
  const same: CartLine = { itemId: 'i-milk', name: 'Milk', quantity: 1, unitPrice: 65, shelfPrice: 65.001 };
  assert.equal(priceChanged(same), false);
  assert.equal(priceChanged({ ...same, shelfPrice: 70 }), true);
  assert.equal(priceChanged({ itemId: 'i-milk', name: 'Milk', quantity: 1, unitPrice: 65 }), false);
});

test('a weight that floating point cannot hold exactly is still read to the gram', () => {
  const line: CartLine = { itemId: 'i-beef', name: 'Beef', quantity: 1.001, unitPrice: 450, weighed: true };
  assert.equal(lineThousandths(line), 1001);
});
