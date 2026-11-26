import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  counterModes,
  DEFAULT_STOCK_SETTINGS,
  mayCloseStockTake,
  mayCountStock,
  mayMoveStock,
  mayOrderAtCounter,
  maySellAtCounter,
  parseStockSettings,
  stockAppMayWrite,
} from '../src/stock-access';

const ON = { spoils: true, stockEdit: true, orderPad: true };

test('a shop that changed nothing has both jobs on', () => {
  for (const body of [null, undefined, 'x', 7, [], {}, { inventory: null }, { inventory: {} }, { inventory: { stockLevels: null } }, { inventory: { stockLevels: {} } }]) {
    assert.deepEqual(parseStockSettings(body), DEFAULT_STOCK_SETTINGS, JSON.stringify(body));
  }
  assert.deepEqual(DEFAULT_STOCK_SETTINGS, ON);
});

test('only a switch that is plainly false turns a job off', () => {
  const settings = (levels: Record<string, unknown>) => parseStockSettings({ inventory: { stockLevels: levels } });
  assert.deepEqual(settings({ allowSpoilsForGroceryClerk: false }), { spoils: false, stockEdit: true, orderPad: true });
  assert.deepEqual(settings({ allowStockEditForGroceryClerk: false }), { spoils: true, stockEdit: false, orderPad: true });
  assert.deepEqual(settings({ allowOrderPadForGroceryClerk: false }), { spoils: true, stockEdit: true, orderPad: false });
  assert.deepEqual(settings({ allowSpoilsForGroceryClerk: false, allowStockEditForGroceryClerk: false }), { spoils: false, stockEdit: false, orderPad: true });
  assert.deepEqual(settings({ allowSpoilsForGroceryClerk: 'false', allowStockEditForGroceryClerk: 0 }), ON);
  assert.deepEqual(settings({ allowSpoilsForGroceryClerk: null, allowStockEditForGroceryClerk: true }), ON);
});

test('a grocery clerk is offered Spoils and Edit stock, with or without the permission on the role', () => {
  assert.deepEqual(counterModes({ roleKey: 'grocery_clerk', permissions: ['grocery.invoices.create'] }, ON), ['sell', 'spoils', 'stockEdit']);
  assert.deepEqual(counterModes({ roleKey: 'Grocery_Manager ', permissions: [] }, ON), ['sell', 'spoils', 'stockEdit']);
});

test('the shop\'s switches take jobs away from a grocery counter', () => {
  assert.deepEqual(counterModes({ roleKey: 'grocery_clerk', permissions: [] }, { spoils: false, stockEdit: true, orderPad: true }), ['sell', 'stockEdit']);
  assert.deepEqual(counterModes({ roleKey: 'grocery_clerk', permissions: [] }, { spoils: true, stockEdit: false, orderPad: true }), ['sell', 'spoils']);
  assert.deepEqual(counterModes({ roleKey: 'grocery_clerk', permissions: [] }, { spoils: false, stockEdit: false, orderPad: true }), ['sell']);
});

test('someone who may write stock sees the stock jobs; selling needs the invoice right', () => {
  // inventory.write alone is a stock-only clerk: Edit stock and Spoils, but no selling.
  assert.deepEqual(counterModes({ roleKey: 'owner', permissions: ['inventory.write'] }, ON), ['spoils', 'stockEdit']);
  assert.deepEqual(counterModes({ roleKey: 'owner', permissions: ['inventory.write'] }, { spoils: false, stockEdit: true, orderPad: true }), ['stockEdit']);
  // With the invoice right as well, selling is offered alongside the stock jobs.
  assert.deepEqual(counterModes({ roleKey: 'owner', permissions: ['inventory.write', 'grocery.invoices.create'] }, ON), ['sell', 'spoils', 'stockEdit']);
});

test('ordering needs the order-pad switch and path-a write or a grocery-counter role', () => {
  assert.equal(mayOrderAtCounter({ roleKey: 'grocery_clerk', permissions: [] }, ON), true);
  assert.equal(mayOrderAtCounter({ roleKey: 'owner', permissions: ['purchasing.path_a.write'] }, ON), true);
  assert.equal(mayOrderAtCounter({ roleKey: 'cashier', permissions: ['sales.sell'] }, ON), false);
  assert.equal(mayOrderAtCounter({ roleKey: 'grocery_clerk', permissions: [] }, { ...ON, orderPad: false }), false);
});

test('selling needs the invoice right or a grocery-counter role', () => {
  // A grocery-counter role may sell by default (the server delegates the right).
  assert.equal(maySellAtCounter({ roleKey: 'grocery_clerk', permissions: [] }), true);
  assert.equal(maySellAtCounter({ roleKey: 'anything', permissions: ['grocery.invoices.create'] }), true);
  // No invoice right and not a grocery-counter role: no selling.
  assert.equal(maySellAtCounter({ roleKey: 'cashier', permissions: ['sales.sell'] }), false);
  assert.equal(maySellAtCounter({ roleKey: undefined, permissions: [] }), false);
  assert.equal(maySellAtCounter({ roleKey: null, permissions: ['inventory.read'] }), false);
});

test('a stock-only clerk is offered no selling, only the stock jobs they are allowed', () => {
  // inventory.read alone: in the app, but nothing switched on here.
  assert.deepEqual(counterModes({ roleKey: null, permissions: ['inventory.read'] }, ON), []);
  // A cashier role in the grocery app without the invoice right does not sell here.
  assert.deepEqual(counterModes({ roleKey: 'cashier', permissions: ['sales.sell'] }, ON), []);
});

test('in the Stock app a stock manager may write, and the grocery switches do not apply', () => {
  assert.equal(stockAppMayWrite({ roleKey: 'stock_manager', permissions: ['inventory.read'] }), true);
  assert.equal(stockAppMayWrite({ roleKey: ' Stock_Manager', permissions: [] }), true);
  assert.equal(stockAppMayWrite({ roleKey: 'custom', permissions: ['inventory.write'] }), true);
  assert.equal(stockAppMayWrite({ roleKey: 'grocery_clerk', permissions: [] }), false);
  assert.equal(stockAppMayWrite({ roleKey: 'cashier', permissions: ['sales.sell'] }), false);
  assert.equal(stockAppMayWrite({ roleKey: null, permissions: [] }), false);
});

test('counting, closing and moving stock follow their own permissions', () => {
  const manager = { roleKey: 'stock_manager', permissions: ['inventory.read', 'inventory.transfer', 'stocktake.read', 'stocktake.run', 'stocktake.approve'] };
  assert.equal(mayCountStock(manager), true);
  assert.equal(mayCloseStockTake(manager), true);
  assert.equal(mayMoveStock(manager), true);
  const reader = { roleKey: 'stock_manager', permissions: ['inventory.read', 'stocktake.read'] };
  assert.equal(mayCountStock(reader), false);
  assert.equal(mayCloseStockTake(reader), false);
  assert.equal(mayMoveStock(reader), false);
  const counter = { roleKey: 'custom', permissions: ['stocktake.run'] };
  assert.equal(mayCountStock(counter), true);
  assert.equal(mayCloseStockTake(counter), false);
});
