import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGroceryInvoiceReceipt } from '../src/printing/grocery-invoice-receipt';

test('department invoice slip includes pay-at-cashier wording and the code', () => {
  const slip = buildGroceryInvoiceReceipt({
    businessName: 'Palmart',
    branchName: 'Mirema',
    clerkName: 'Amina',
    code: '4829137051',
    createdAt: Date.parse('2026-11-26T06:00:00Z'),
    lines: [
      {
        lineId: '1',
        itemId: 'i1',
        name: 'Tomatoes',
        unitName: 'kg',
        weighed: true,
        quantityUnits: 12_500,
        unitCents: 20_000,
      },
    ],
    totalCents: 25_000,
  });
  const text = slip.preview();
  assert.match(text, /PALMART/);
  assert.match(text, /DEPARTMENT INVOICE/);
  assert.match(text, /4829137051/);
  assert.match(text, /Pay at cashier/);
  assert.match(text, /TOTAL KES/);
  assert.match(text, /Tomatoes/);
});
