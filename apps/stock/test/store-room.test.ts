import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import {
  canWriteMovement,
  effectWords,
  findEcho,
  formatCount,
  mayDecide,
  parseMoveQty,
  packWords,
  readPack,
  readActivity,
  readRows,
  readSettings,
  reasonById,
  rowByBarcode,
  rowForProduct,
  shownCount,
  writeOutcome,
  type StoreMovement,
  type StoreRow,
} from '../src/lib/store-room';

const MILK: StoreRow = {
  id: 's1',
  name: 'Milk',
  barcode: '123',
  itemId: 'i1',
  quantity: 0,
  inventoryQuantity: 12,
  inventoryItemName: 'Fresh milk',
  expiryDate: '2026-12-01',
  buyingPrice: 50,
};

test('a connected linked row shows the live count, and a missing one stays unknown', () => {
  assert.deepEqual(shownCount(MILK, 'connected'), { text: '12', followsShelf: true });
  assert.deepEqual(shownCount({ ...MILK, inventoryQuantity: null }, 'connected'), { text: '—', followsShelf: true });
  assert.deepEqual(shownCount({ ...MILK, quantity: 4 }, 'standalone'), { text: '4', followsShelf: false });
  assert.equal(formatCount(1.5), '1.5');
});

test('a loss on a linked row needs inventory write; a shelf restock accepts catalogue write', () => {
  const spoilage = reasonById('spoilage');
  const restock = reasonById('restock_to_shelf');
  if (!spoilage || !restock) throw new Error('reason missing');
  assert.equal(effectWords(spoilage), 'Writes this off');
  assert.equal(effectWords(restock), 'The till does not change');
  assert.equal(canWriteMovement({ mode: 'connected', linked: true, changesStock: true, inventory: false, catalog: true }), false);
  assert.equal(canWriteMovement({ mode: 'connected', linked: true, changesStock: false, inventory: false, catalog: true }), true);
  assert.equal(canWriteMovement({ mode: null, linked: false, changesStock: false, inventory: true, catalog: true }), false);
});

test('the person who raised a take-out cannot approve it when a second person is required', () => {
  assert.equal(mayDecide({ approve: true, inventory: true, separate: true, createdBy: 'me', userId: 'me' }), false);
  assert.equal(mayDecide({ approve: false, inventory: true, separate: true, createdBy: 'me', userId: 'me' }), true);
  assert.equal(mayDecide({ approve: true, inventory: false, separate: false, createdBy: 'me', userId: 'other' }), false);
});

test('a whole-number row refuses a fraction', () => {
  assert.equal(parseMoveQty('2', true), 2);
  assert.equal(parseMoveQty('2.5', true), null);
  assert.equal(parseMoveQty('2.5', false), 2.5);
  assert.equal(parseMoveQty('0', false), null);
});

test('a lost movement is recognised in the following two minutes, and a refusal keeps the server sentence', () => {
  const sentAt = Date.parse('2026-11-27T09:00:00Z');
  const echo: StoreMovement = {
    id: 'm1',
    storeItemId: 's1',
    storeItemName: 'Milk',
    direction: 'out',
    reason: 'spoilage',
    stockEffect: 'decrease',
    status: 'pending',
    quantity: 2,
    note: null,
    createdAt: sentAt + 1000,
    createdBy: 'me',
    createdByName: 'Ada',
  };
  assert.equal(findEcho([echo], { storeItemId: 's1', reason: 'spoilage', quantity: 2, actorId: 'me', sentAt })?.id, 'm1');
  assert.equal(findEcho([echo], { storeItemId: 's1', reason: 'theft', quantity: 2, actorId: 'me', sentAt }), null);
  assert.deepEqual(writeOutcome(new ApiError('Only 1 in the store room.', { status: 400 })), {
    kind: 'refused',
    words: 'Only 1 in the store room.',
  });
  assert.equal(writeOutcome(new Error('network')).kind, 'lost');
});

test('a pack is named in the unit the person types, and the shelf count is the multiple', () => {
  assert.equal(readPack({ packageVariant: true, packagingUnitQty: 12, packagingUnitName: 'tray' })?.each, 12);
  assert.equal(readPack({ packageVariant: false, packagingUnitQty: 12 }), null);
  assert.equal(readPack({ packageVariant: true, packagingUnitQty: 1 }), null);
  const pack = readPack({ packageVariant: true, packagingUnitQty: '12', packagingUnitName: 'tray' });
  if (!pack) {
    assert.fail('expected a pack');
    return;
  }
  assert.equal(packWords(pack, 2), '2 tray counts as 24 on the shelf.');
  assert.match(packWords(pack, null), /Counted in tray/);
});

test('rows and settings drop what is not a store room', () => {
  const rows = readRows([{ ...MILK, inventoryQuantity: '3.5' }, { name: 'no id' }]);
  assert.equal(rows?.length, 1);
  assert.equal(rows?.[0]?.inventoryQuantity, 3.5);
  assert.equal(rowByBarcode(rows ?? [], '123')?.id, 's1');
  assert.equal(rowForProduct(rows ?? [], { id: 'other', barcode: '123' })?.id, 's1');
  assert.deepEqual(readSettings({ mode: 'connected', requireSeparateApprover: true }), {
    mode: 'connected',
    requireSeparateApprover: true,
  });
  assert.equal(readSettings({ mode: 'later' })?.mode, null);
  const activity = readActivity({
    movements: [{ id: 'm', direction: 'in', stockEffect: 'none', status: 'applied', quantity: '4', createdAt: '2026-11-27T09:00:00Z', reason: 'from_purchase_order', storeItemId: 's1', storeItemName: 'Milk', createdBy: 'me', createdByName: 'Ada' }],
  });
  assert.equal(activity?.[0]?.quantity, 4);
  assert.equal(readActivity({ movements: 'no' }), null);
});
