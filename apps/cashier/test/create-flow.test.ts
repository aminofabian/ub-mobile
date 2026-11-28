import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import type { CartItem } from '../src/lib/cart';
import { createProduct, leftUnweighedNotice, lookForItNotice, markAsWeighed } from '../src/lib/create-flow';
import { NotAnsweredInTime } from '../src/lib/reach';
import type { QuickCreateBody } from '../src/lib/quick-product';

const BODY: QuickCreateBody = { name: 'Tomatoes', itemTypeId: 't-1', branchId: 'b-1', unitType: 'each', unitPrice: 120 };
const MADE: CartItem = { id: 'i-9', name: 'Tomatoes', sellingPrice: 120 };

function spy() {
  const calls: string[] = [];
  return {
    calls,
    create: async (body: QuickCreateBody) => {
      calls.push(`create ${body.name}`);
      return MADE;
    },
    mark: async (id: string) => {
      calls.push(`mark ${id}`);
    },
  };
}

test('a product added by the unit is done, ready to ring up, with nothing marked', async () => {
  const { calls, create, mark } = spy();
  const outcome = await createProduct({ body: BODY, byWeight: false, create, mark });
  assert.deepEqual(outcome, { kind: 'done', item: MADE, notice: 'Added Tomatoes. Tap it to sell it.' });
  assert.deepEqual(calls, ['create Tomatoes']);
});

test('a product sold by weight is marked once it is added, and comes back as sold by the kilogram', async () => {
  const { calls, create, mark } = spy();
  const outcome = await createProduct({ body: { ...BODY, unitType: 'kg' }, byWeight: true, create, mark });
  assert.equal(outcome.kind, 'done');
  if (outcome.kind === 'done') {
    assert.equal(outcome.item.weighed, true);
    assert.equal(outcome.item.unitType, 'kg');
    assert.equal(outcome.item.id, 'i-9');
  }
  assert.deepEqual(calls, ['create Tomatoes', 'mark i-9']);
});

test('a server that says no adds nothing and says why, and the form can be sent again', async () => {
  const outcome = await createProduct({
    body: BODY,
    byWeight: false,
    create: async () => {
      throw new ApiError('no', { status: 403 });
    },
    mark: async () => undefined,
  });
  assert.equal(outcome.kind, 'refused');
  assert.match(outcome.kind === 'refused' ? outcome.words : '', /not allowed to add products/);
});

test('an add nobody answered is in doubt, never marked, and never asked to be sent again', async () => {
  for (const error of [new TypeError('Network request failed'), new NotAnsweredInTime(), new ApiError('Bad gateway', { status: 502 })]) {
    const calls: string[] = [];
    const outcome = await createProduct({
      body: { ...BODY, unitType: 'kg' },
      byWeight: true,
      create: async () => {
        calls.push('create');
        throw error;
      },
      mark: async () => {
        calls.push('mark');
      },
    });
    assert.equal(outcome.kind, 'unknown');
    assert.deepEqual(calls, ['create'], 'one try, and nothing marked on a product that may not exist');
  }
});

test('a product that was added but could not be marked stays in hand, with the product, so only the marking is tried again', async () => {
  const outcome = await createProduct({
    body: { ...BODY, unitType: 'kg' },
    byWeight: true,
    create: async () => MADE,
    mark: async () => {
      throw new TypeError('Network request failed');
    },
  });
  assert.equal(outcome.kind, 'weight');
  if (outcome.kind !== 'weight') return;
  assert.deepEqual(outcome.made, MADE);
  assert.match(outcome.words, /could not be marked as sold by weight/);

  const calls: string[] = [];
  const again = await markAsWeighed(outcome.made, async (id) => {
    calls.push(`mark ${id}`);
  });
  assert.deepEqual(calls, ['mark i-9'], 'the product is not added a second time');
  assert.equal(again.kind, 'done');
  assert.equal(again.kind === 'done' && again.item.weighed, true);
});

test('marking can fail again, and says so again', async () => {
  const again = await markAsWeighed(MADE, async () => {
    throw new ApiError('no', { status: 403 });
  });
  assert.equal(again.kind, 'weight');
  assert.match(again.kind === 'weight' ? again.words : '', /not allowed to mark it as sold by weight/);
});

test('leaving a product unmarked is said plainly, and looking for one that may exist says what to do next', () => {
  assert.match(leftUnweighedNotice('Tomatoes'), /^Tomatoes was added but is NOT marked as sold by weight yet\. Do not sell it/);
  assert.match(lookForItNotice('Tomatoes'), /^Look for Tomatoes below\./);
  assert.match(lookForItNotice('Tomatoes'), /If it is there, it was added: sell it from the list\. If not, add it again\.$/);
});
