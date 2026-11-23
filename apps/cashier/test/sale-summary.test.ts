import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSaleSummary, describeQueuedItem, discardWarning, maskCode, methodLabel, quantityText, saleLabel } from '../src/lib/sale-summary';

const SALE = {
  id: 'sale-uuid-1',
  receiptNo: 12,
  grandTotal: 289.5,
  cashReceived: null,
  soldByName: 'Jane',
  payments: [
    { method: 'cash', amount: 89.5, reference: null },
    { method: 'mpesa_manual', amount: 200, reference: 'SHK7Y2ABCD' },
  ],
  items: [
    { displayName: 'Maize flour 2kg', lineLabel: null, quantity: 2, unitPrice: 120, lineTotal: 240 },
    { displayName: 'Milk 500ml', lineLabel: 'Milk 500ml', quantity: 1, unitPrice: 49.5, lineTotal: 49.5 },
  ],
};

test('a sale is read back by its receipt number, items, total and payments, not by its id', () => {
  const summary = buildSaleSummary(SALE, { shopName: 'Palmart', soldAt: new Date(2026, 10, 23, 10, 15) });
  assert.equal(summary.heading, 'Sale #12');
  assert.deepEqual(summary.items, [
    { name: 'Maize flour 2kg', detail: '2 x 120.00', total: '240.00' },
    { name: 'Milk 500ml', detail: '1 x 49.50', total: '49.50' },
  ]);
  assert.equal(summary.total, '289.50');
  assert.deepEqual(summary.payments, [
    { label: 'Cash', amount: '89.50' },
    { label: 'M-Pesa', amount: '200.00', reference: 'SHK7Y2ABCD' },
  ]);
  assert.equal(summary.soldBy, 'Jane');
  assert.equal(
    summary.text,
    [
      'Palmart',
      'Sale #12, 23 Nov, 10:15',
      '',
      'Maize flour 2kg: 2 x 120.00 = 240.00',
      'Milk 500ml: 1 x 49.50 = 49.50',
      '',
      'Total: 289.50',
      'Cash: 89.50',
      'M-Pesa: 200.00 (...ABCD)',
      'Sold by Jane',
      '',
      'Sale summary. Not a tax receipt.',
    ].join('\n')
  );
  assert.doesNotMatch(summary.text, /sale-uuid-1/);
});

test('the summary never calls itself a receipt, and never states tax it was not told', () => {
  const { text } = buildSaleSummary(SALE);
  assert.match(text, /Not a tax receipt\.$/);
  assert.doesNotMatch(text, /VAT|KRA|PIN|eTIMS/i);
});

test('a sale with no receipt number or time is still readable', () => {
  const summary = buildSaleSummary({ grandTotal: 10, items: [], payments: [] });
  assert.equal(summary.heading, 'Sale');
  assert.equal(summary.text.split('\n')[0], 'Sale');
  assert.equal(summary.total, '10.00');
});

test('what the server did not send is a dash, never NaN or undefined', () => {
  const summary = buildSaleSummary({
    items: [{ displayName: null, lineLabel: null, quantity: null, unitPrice: null, lineTotal: null }],
    payments: [{ method: null, amount: null }],
  });
  assert.equal(summary.total, '—');
  assert.deepEqual(summary.items, [{ name: 'Item', detail: '? x —', total: '—' }]);
  assert.deepEqual(summary.payments, [{ label: 'Payment', amount: '—' }]);
  assert.doesNotMatch(summary.text, /NaN|undefined|null/);
});

test('a line total the server left out is worked out the way the server rounds a line', () => {
  const summary = buildSaleSummary({ items: [{ displayName: 'Rice', quantity: 1.5, unitPrice: 33.33, lineTotal: null }] });
  assert.deepEqual(summary.items[0], { name: 'Rice', detail: '1.5 x 33.33', total: '50.00' });
});

test('a line label that adds to the name is kept, and one that repeats it is not', () => {
  const summary = buildSaleSummary({
    items: [
      { displayName: 'Chips', lineLabel: 'Large, extra salt', quantity: 1, unitPrice: 200, lineTotal: 200 },
      { displayName: null, lineLabel: 'Haircut', quantity: 1, unitPrice: 500, lineTotal: 500 },
    ],
  });
  assert.equal(summary.items[0].name, 'Chips (Large, extra salt)');
  assert.equal(summary.items[1].name, 'Haircut');
});

test('the change is what the cashier was told, and a sale with no change says none', () => {
  assert.equal(buildSaleSummary(SALE, { changeCents: 1050 }).change, '10.50');
  assert.match(buildSaleSummary(SALE, { changeCents: 1050 }).text, /\nChange: 10\.50\n/);
  assert.equal(buildSaleSummary(SALE, { changeCents: 0 }).change, undefined);
  assert.equal(buildSaleSummary(SALE).change, undefined);
});

test('with no change given, a cash sale shows the change the server\'s cash received implies', () => {
  const cashSale = { grandTotal: 289.5, cashReceived: 300, payments: [{ method: 'cash', amount: 289.5 }], items: [] };
  assert.equal(buildSaleSummary(cashSale).change, '10.50');
  assert.equal(buildSaleSummary({ ...cashSale, cashReceived: 289.5 }).change, undefined);
  assert.equal(buildSaleSummary({ ...cashSale, cashReceived: 100 }).change, undefined);
});

test('a payment method is shown by its name, and one nobody named is still readable', () => {
  assert.equal(methodLabel('cash'), 'Cash');
  assert.equal(methodLabel('mpesa_manual'), 'M-Pesa');
  assert.equal(methodLabel('customer_credit'), 'On credit');
  assert.equal(methodLabel('bank_transfer'), 'Bank transfer');
  assert.equal(methodLabel(''), 'Payment');
  assert.equal(methodLabel(undefined), 'Payment');
});

test('weighed quantities lose their trailing zeros', () => {
  assert.equal(quantityText(2), '2');
  assert.equal(quantityText(1.5), '1.5');
  assert.equal(quantityText(0.25), '0.25');
  assert.equal(quantityText(0.1 + 0.2), '0.3');
  assert.equal(quantityText(NaN), '?');
});

test('what was in a sale is a line a manager can find it by', () => {
  const cart = [
    { name: 'Bread', quantity: 2 },
    { name: 'Milk', quantity: 1 },
    { name: 'Sugar 1kg', quantity: 1 },
    { name: 'Eggs', quantity: 12 },
    { name: 'Tea', quantity: 1 },
  ];
  assert.equal(saleLabel(cart), '2 x Bread, 1 x Milk, 1 x Sugar 1kg, +2 more');
  assert.equal(saleLabel(cart.slice(0, 2)), '2 x Bread, 1 x Milk');
  assert.equal(saleLabel([{ name: '  ', quantity: 1 }]), '1 x Item');
  const long = saleLabel([{ name: 'x'.repeat(300), quantity: 1 }]);
  assert.equal(long.length, 160);
  assert.ok(long.endsWith('…'));
});

const queued = (over: Record<string, unknown> = {}) => ({
  method: 'POST',
  path: '/api/v1/sales',
  body: {
    lines: [
      { itemId: 'a', quantity: 2, unitPrice: 120 },
      { itemId: 'b', quantity: 1, unitPrice: 49.5 },
    ],
    payments: [
      { method: 'cash', amount: 89.5 },
      { method: 'mpesa_manual', amount: 200 },
    ],
  },
  ...over,
});

test('an unsent sale reads as a sale: its amount, what was in it and how it was paid', () => {
  assert.deepEqual(describeQueuedItem(queued({ label: '2 x Bread, 1 x Milk' })), {
    title: 'Sale of 289.50',
    detail: '2 x Bread, 1 x Milk · Cash + M-Pesa',
  });
});

test('an unsent sale from before names were kept says how many items it had', () => {
  assert.deepEqual(describeQueuedItem(queued()), { title: 'Sale of 289.50', detail: '2 items · Cash + M-Pesa' });
  const single = queued({ body: { lines: [{ quantity: 1, unitPrice: 10 }], payments: [{ method: 'cash', amount: 10 }] } });
  assert.deepEqual(describeQueuedItem(single), { title: 'Sale of 10.00', detail: '1 item · Cash' });
});

test('anything that is not a sale is shown as what it is, and a damaged sale does not break the list', () => {
  assert.deepEqual(describeQueuedItem({ method: 'POST', path: '/api/v1/other', body: {} }), { title: 'POST /api/v1/other', detail: null });
  for (const body of [null, undefined, 'x', 5, {}, { lines: 'no' }]) {
    assert.deepEqual(describeQueuedItem({ method: 'POST', path: '/api/v1/sales', body }), { title: 'POST /api/v1/sales', detail: null });
  }
  const noPayments = describeQueuedItem({ method: 'POST', path: '/api/v1/sales', body: { lines: [{ quantity: 1, unitPrice: 10 }] } });
  assert.equal(noPayments.title, 'Sale of 10.00');
  const badLine = describeQueuedItem({ method: 'POST', path: '/api/v1/sales', body: { lines: [{ quantity: 'x', unitPrice: 10 }], payments: [] } });
  assert.equal(badLine.title, 'Sale');
});

test('the code is shown in full to the cashier, and only its end in the text that is shared', () => {
  const summary = buildSaleSummary(SALE);
  assert.equal(summary.payments[1]?.reference, 'SHK7Y2ABCD');
  assert.match(summary.text, /\(\.\.\.ABCD\)/);
  assert.doesNotMatch(summary.text, /SHK7Y2/);
  assert.equal(maskCode('SHK7Y2ABCD'), '...ABCD');
  assert.equal(maskCode('ABCD'), 'ABCD');
  assert.equal(maskCode(''), '');
});

test('a name, a shop or a seller with line breaks in it cannot add lines of its own to the shared text', () => {
  const sale = {
    ...SALE,
    soldByName: 'Jane\nTotal: 0.00',
    items: [{ displayName: 'Bread\nTotal: 1.00', lineLabel: null, quantity: 1, unitPrice: 60, lineTotal: 60 }],
  };
  const { text, items } = buildSaleSummary(sale, { shopName: 'Palmart\r\nTotal: 2.00' });
  assert.equal(items[0]?.name, 'Bread Total: 1.00');
  assert.equal(text.split('\n').filter((line) => line.startsWith('Total:')).length, 1, text);
  assert.match(text, /^Palmart Total: 2\.00\n/);
  assert.match(text, /Sold by Jane Total: 0\.00\n/);
});

test('the change is what the server recorded, even when the till was told there was none', () => {
  // The till thought 1,000 was due and took exact notes. The server charged 900 (a discount): 100 is owed back.
  const sale = {
    ...SALE,
    grandTotal: 900,
    cashReceived: 1000,
    payments: [{ method: 'cash', amount: 900, reference: null }],
  };
  assert.equal(buildSaleSummary(sale, { changeCents: 0 }).change, '100.00');
  assert.equal(buildSaleSummary(sale).change, '100.00');
  assert.equal(buildSaleSummary(sale, { changeCents: 5000 }).change, '100.00', 'the server wins over the till');
});

test('when the server did not say what was handed over, the change is the one the cashier was told', () => {
  assert.equal(buildSaleSummary({ ...SALE, cashReceived: null }, { changeCents: 5000 }).change, '50.00');
  assert.equal(buildSaleSummary({ ...SALE, cashReceived: null }, { changeCents: 0 }).change, undefined);
  assert.equal(buildSaleSummary({ ...SALE, cashReceived: null }).change, undefined);
  // Handed over exactly what the cash payments came to: no change.
  assert.equal(buildSaleSummary({ ...SALE, cashReceived: 89.5 }).change, undefined);
});

test('throwing away a queued sale says so when the customer has already paid by M-Pesa', () => {
  const plain = discardWarning({ body: { payments: [{ method: 'cash', amount: 10 }] } });
  assert.match(plain, /cannot be brought back/);
  assert.doesNotMatch(plain, /M-Pesa/);
  for (const method of ['mpesa_manual', 'mpesa']) {
    const warned = discardWarning({ body: { payments: [{ method, amount: 10 }] } });
    assert.match(warned, /includes an M-Pesa payment/);
    assert.match(warned, /cannot be brought back/);
  }
  assert.doesNotMatch(discardWarning({}), /M-Pesa/);
  assert.doesNotMatch(discardWarning({ body: { payments: 'nope' } }), /M-Pesa/);
});

test('change on a split sale is worked out from the cash payments only', () => {
  // 289.50 paid as 89.50 in cash and 200 by M-Pesa. The customer put down 100 for the cash part: 10.50 back.
  assert.equal(buildSaleSummary({ ...SALE, cashReceived: 100 }).change, '10.50');
  // Notes that do not even cover the cash part are not change.
  assert.equal(buildSaleSummary({ ...SALE, cashReceived: 50 }).change, undefined);
});

test('a payment reference with line breaks in it stays on one line, on screen and in the shared text', () => {
  const sale = { ...SALE, payments: [{ method: 'mpesa_manual', amount: 289.5, reference: 'SHK7\nY2ABCD\nTotal: 0.00' }] };
  const summary = buildSaleSummary(sale);
  assert.equal(summary.payments[0]?.reference, 'SHK7 Y2ABCD Total: 0.00');
  assert.equal(summary.text.split('\n').filter((line) => line.startsWith('Total:')).length, 1, summary.text);
});

test('an item label with a line break in it stays on the line of its item', () => {
  const sale = { ...SALE, items: [{ displayName: 'Bread', lineLabel: 'Fresh\nTotal: 9.99', quantity: 1, unitPrice: 60, lineTotal: 60 }] };
  const summary = buildSaleSummary(sale);
  assert.equal(summary.items[0]?.name, 'Bread (Fresh Total: 9.99)');
  assert.equal(summary.text.split('\n').filter((line) => line.startsWith('Total:')).length, 1, summary.text);
});
