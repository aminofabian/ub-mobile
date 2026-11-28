import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSystemUnassignedSupplier,
  NO_SUPPLIER_WORDS,
  realSuppliers,
  supplierNameOrLink,
} from '../src/lib/supplier-words';

test('the migration bucket is recognised by its code, whatever it is called', () => {
  assert.equal(isSystemUnassignedSupplier({ code: 'SYS-UNASSIGNED', name: 'Anything' }), true);
  assert.equal(isSystemUnassignedSupplier({ code: 'sys-unassigned', name: null }), true);
});

test('the migration bucket is recognised by the names it has worn', () => {
  assert.equal(isSystemUnassignedSupplier({ name: 'Unassigned (migrate)' }), true);
  assert.equal(isSystemUnassignedSupplier({ name: 'Unassigned (migrated)' }), true);
  assert.equal(isSystemUnassignedSupplier({ name: '  unassigned  ' }), true);
});

test('a real supplier is left alone', () => {
  assert.equal(isSystemUnassignedSupplier({ code: 'SUP-12', name: 'Mwangi Distributors' }), false);
  assert.equal(isSystemUnassignedSupplier({ name: 'Unassigned Traders' }), false, 'a shop may really be called that');
  assert.equal(isSystemUnassignedSupplier({ name: null, code: null }), false);
});

test('the till says there is no supplier rather than showing a migrated placeholder', () => {
  assert.equal(supplierNameOrLink({ code: 'SYS-UNASSIGNED', name: 'Unassigned (migrate)' }), NO_SUPPLIER_WORDS);
  assert.equal(supplierNameOrLink({ name: 'Unassigned (migrated)' }), NO_SUPPLIER_WORDS);
  assert.equal(supplierNameOrLink({ name: '   ' }), NO_SUPPLIER_WORDS);
  assert.equal(supplierNameOrLink({ name: null }), NO_SUPPLIER_WORDS);
  assert.equal(NO_SUPPLIER_WORDS, 'No supplier linked');
});

test('the picker offers only people the shop could actually buy from', () => {
  const list = [
    { id: '1', name: 'Unassigned (migrate)', code: 'SYS-UNASSIGNED' },
    { id: '2', name: 'Mwangi Distributors', code: 'SUP-2' },
    { id: '3', name: 'Unassigned', code: null },
    { id: '4', name: 'Kericho Dairy', code: 'SUP-4' },
  ];
  assert.deepEqual(
    realSuppliers(list).map((s) => s.id),
    ['2', '4']
  );
});
