import assert from 'node:assert/strict';
import test from 'node:test';
import { ownerAccess, visibleTabs, type OwnerAccess } from '../src/lib/owner-access';

const NOTHING: OwnerAccess = { takings: false, orders: false, stock: false, writeStock: false, credit: false, recordPayments: false, receive: false, sell: false, invoices: false };
const user = (permissions: string[], roleKey: string | null = null) => ({ roleKey, permissions });

test('a person with no permissions is offered nothing', () => {
  assert.deepEqual(ownerAccess(user([])), NOTHING);
});

test('each permission opens exactly the part it is for', () => {
  assert.deepEqual(ownerAccess(user(['finance.reports.read'])), { ...NOTHING, takings: true });
  assert.deepEqual(ownerAccess(user(['storefront.orders.read'])), { ...NOTHING, orders: true });
  assert.deepEqual(ownerAccess(user(['catalog.items.read'])), { ...NOTHING, stock: true });
  assert.deepEqual(ownerAccess(user(['inventory.write'])), { ...NOTHING, writeStock: true });
  assert.deepEqual(ownerAccess(user(['credits.customers.read'])), { ...NOTHING, credit: true });
  assert.deepEqual(ownerAccess(user(['credits.claims.review'])), { ...NOTHING, recordPayments: true });
  assert.deepEqual(ownerAccess(user(['purchasing.path_a.read', 'purchasing.path_a.write'])), { ...NOTHING, receive: true });
});

test('a permission that only sounds alike opens nothing', () => {
  const near = ['finance.reports', 'storefront.orders', 'catalog.items', 'inventory.read', 'credits.customers', 'credits.claims.read', 'purchasing.path_b.read', 'FINANCE.REPORTS.READ', 'sales.selling'];
  assert.deepEqual(ownerAccess(user(near)), NOTHING);
});

test('a stock manager may set stock whatever the list says, and a clerk may not', () => {
  assert.equal(ownerAccess(user([], 'stock_manager')).writeStock, true);
  assert.equal(ownerAccess(user([], 'cashier')).writeStock, false);
  assert.equal(ownerAccess(user(['inventory.write'], 'cashier')).writeStock, true);
});

test('the tabs are Today and More always, and the rest only when the permission is there', () => {
  assert.deepEqual(visibleTabs(NOTHING), ['Today', 'More']);
  assert.deepEqual(visibleTabs({ ...NOTHING, sell: true }), ['Sell', 'Today', 'More']);
  assert.deepEqual(visibleTabs({ ...NOTHING, orders: true }), ['Today', 'Orders', 'More']);
  assert.deepEqual(visibleTabs({ ...NOTHING, invoices: true }), ['Today', 'Invoices', 'More']);
  assert.deepEqual(visibleTabs({ ...NOTHING, stock: true }), ['Today', 'Stock', 'More']);
  assert.deepEqual(visibleTabs({ ...NOTHING, credit: true }), ['Today', 'Credit', 'More']);
  assert.deepEqual(visibleTabs({ ...NOTHING, orders: true, stock: true, credit: true }), ['Today', 'Orders', 'Stock', 'Credit', 'More']);
});

test('what only changes a button does not add or remove a tab', () => {
  assert.deepEqual(visibleTabs({ ...NOTHING, takings: true, writeStock: true, recordPayments: true, receive: true }), ['Today', 'More']);
});

test('a person built without a permission list gets no access and no crash', () => {
  for (const bad of [undefined, null, 'finance.reports.read', { includes: () => true }, 5]) {
    const person = { roleKey: undefined, permissions: bad as unknown as string[] };
    assert.deepEqual(ownerAccess(person), NOTHING, String(bad));
    assert.deepEqual(visibleTabs(ownerAccess(person)), ['Today', 'More']);
  }
  // A stock manager's role still counts even when the list is missing: the role is read as well as the list.
  assert.equal(ownerAccess({ roleKey: 'stock_manager', permissions: undefined as unknown as string[] }).writeStock, true);
});

test('receiving a delivery and ordering need both the read and the write permission, because either alone opens a screen that then fails', () => {
  assert.equal(ownerAccess(user(['purchasing.path_a.read'])).receive, false);
  assert.equal(ownerAccess(user(['purchasing.path_a.write'])).receive, false);
  assert.equal(ownerAccess(user(['purchasing.path_a.read', 'purchasing.path_a.write'])).receive, true);
});
