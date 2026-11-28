import assert from 'node:assert/strict';
import test from 'node:test';
import { tapTab } from '../src/lib/tap-route';
import { webUrl } from '../src/lib/web-link';

test('a push with nothing in it, which is what the server sends today, opens Today', () => {
  for (const data of [undefined, null, {}, [], 'x', 5, { title: 'Sales' }, { kind: 5 }, { kind: '' }]) assert.equal(tapTab(data), 'Today', JSON.stringify(data));
});

test('a kind the server may add sends the owner to the screen it is about', () => {
  assert.equal(tapTab({ kind: 'morning_brief' }), 'Today');
  assert.equal(tapTab({ kind: 'daily_sales_digest' }), 'Today');
  assert.equal(tapTab({ kind: 'web_order_paid' }), 'Orders');
  assert.equal(tapTab({ kind: 'storefront.order.placed' }), 'Orders');
  assert.equal(tapTab({ kind: 'order.received' }), 'Orders');
  assert.equal(tapTab({ kind: 'WEB_ORDER_PLACED' }), 'Orders');
  assert.equal(tapTab({ kind: 'order' }), 'Orders');
  assert.equal(tapTab({ kind: 'orders' }), 'Orders');
  assert.equal(tapTab({ kind: 'stock_low' }), 'Stock');
  assert.equal(tapTab({ kind: 'supply.posted' }), 'Stock');
  assert.equal(tapTab({ kind: 'restock_digest' }), 'Stock');
  assert.equal(tapTab({ kind: 'credit_due' }), 'Credit');
  assert.equal(tapTab({ kind: 'tab_overdue' }), 'Credit');
});

test('the name may come as type, kind wins when both are there, and spacing and case do not matter', () => {
  assert.equal(tapTab({ type: 'STOCK_LOW' }), 'Stock');
  assert.equal(tapTab({ kind: 'credit_due', type: 'stock_low' }), 'Credit');
  assert.equal(tapTab({ kind: '  Web_Order_Paid ' }), 'Orders');
  assert.equal(tapTab({ kind: 5, type: 'stock_low' }), 'Stock');
  assert.equal(tapTab({ kind: 'tab' }), 'Credit');
  assert.equal(tapTab({ kind: 'tabs' }), 'Credit');
});

test('a kind that is not known opens Today, and so does one that only looks like a known one', () => {
  for (const kind of ['something_new', 'my_order', 'low_stock', 'the_credit_note', 'orderly', 'table_booking', 'tablet_update', 'tabloid']) {
    assert.equal(tapTab({ kind }), 'Today', kind);
  }
});

test('the shop address becomes a link to the page for the job, and only a plain address does', () => {
  assert.equal(webUrl('palmart.kiosk.ke', 'overview'), 'https://palmart.kiosk.ke/overview');
  assert.equal(webUrl('Palmart.Kiosk.KE', 'orders'), 'https://palmart.kiosk.ke/storefront/web-orders');
  assert.equal(webUrl(' shop.example.com ', 'stock'), 'https://shop.example.com/inventory');
  assert.equal(webUrl('palmart.kiosk.ke', 'credit'), 'https://palmart.kiosk.ke/credits');
  assert.equal(webUrl('palmart.kiosk.ke', 'receive'), 'https://palmart.kiosk.ke/purchasing');
  assert.equal(webUrl('palmart.kiosk.ke', 'team'), 'https://palmart.kiosk.ke/users');
  assert.equal(webUrl('palmart.kiosk.ke', 'settings'), 'https://palmart.kiosk.ke/settings');
});

test('an address that is not a plain host, or has a port, has no link', () => {
  const bad: unknown[] = [undefined, null, 5, '', 'localhost', 'localhost:3000', 'shop.test:3000', 'palmart.kiosk.ke/evil', 'https://palmart.kiosk.ke', 'a b.com', 'palmart.kiosk.ke?x=1', '-a.com', {}];
  for (const host of bad) assert.equal(webUrl(host, 'overview'), null, String(host));
});
