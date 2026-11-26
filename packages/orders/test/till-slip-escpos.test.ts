import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTillSlipEscPos } from '../src/lib/till-slip-escpos';

test('order slip includes heading, supplier and total', () => {
  const bytes = buildTillSlipEscPos(
    {
      reference: 'PO-100',
      supplierName: 'Mwangi Distributors',
      businessName: 'Palmart',
      branchName: 'Mirema',
      placedByName: 'Amina',
      currency: 'KES',
      lines: [{ name: 'Sugar 2kg', qty: 2, unitCost: 250, lineTotal: 500 }],
    },
    'order',
    58,
  );
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /PURCHASE ORDER/);
  assert.match(text, /PO-100/);
  assert.match(text, /Mwangi Distributors/);
  assert.match(text, /TOTAL 500\.00 KES/);
  assert.match(text, /Place with supplier/);
});
