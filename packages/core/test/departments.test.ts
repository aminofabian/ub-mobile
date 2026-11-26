import assert from 'node:assert/strict';
import test from 'node:test';
import { supplierItemTypeScope, visibleDepartments } from '../src/departments';
import type { DepartmentOption } from '../src/stock-items';

const ALL: DepartmentOption[] = [
  { id: 'produce', label: 'Produce', color: null, sortOrder: 1 },
  { id: 'dairy', label: 'Dairy', color: null, sortOrder: 2 },
  { id: 'bakery', label: 'Bakery', color: null, sortOrder: 3 },
];

test('assignments restrict to those departments', () => {
  assert.deepEqual(
    visibleDepartments(ALL, { roleKey: 'grocery_clerk', itemTypeIds: [' dairy ', 'produce', 'dairy'] }).map((d) => d.id),
    ['produce', 'dairy'],
  );
});

test('grocery clerk with none sees nothing', () => {
  assert.deepEqual(visibleDepartments(ALL, { roleKey: 'grocery_clerk', itemTypeIds: [] }), []);
});

test('other roles with none see every department', () => {
  assert.deepEqual(
    visibleDepartments(ALL, { roleKey: 'owner', itemTypeIds: [] }).map((d) => d.id),
    ['produce', 'dairy', 'bakery'],
  );
});

test('supplier scope matches department rail rules', () => {
  assert.deepEqual(
    supplierItemTypeScope({ roleKey: 'grocery_clerk', itemTypeIds: ['produce'] }),
    ['produce'],
  );
  assert.deepEqual(supplierItemTypeScope({ roleKey: 'grocery_clerk', itemTypeIds: [] }), []);
  assert.equal(supplierItemTypeScope({ roleKey: 'owner', itemTypeIds: [] }), undefined);
});
