import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Basket, emptyBasket } from '../src/lib/basket';
import { decodeDrafts, draftsFor, dropDraft, encodeDrafts, parkDraft, resumeDraft } from '../src/lib/drafts';

const NOW = 1_700_000_000_000;
const OWNER = { ownerId: 'cashier-1', branchId: 'br' };

function basketWith(name: string): Basket {
  return {
    ...emptyBasket(OWNER, NOW),
    lines: [
      { lineId: 'l1', itemId: 'i1', name, unitName: 'units', weighed: false, quantityUnits: 10_000, unitCents: 15_500 },
    ],
  };
}

test('parking takes the basket off the counter and names it by its first line', () => {
  const parked = parkDraft(null, basketWith('Sunrise Milk'), '', NOW);
  assert.equal(parked.ok, true);
  if (!parked.ok) return;
  assert.equal(parked.state.items.length, 1);
  assert.equal(parked.state.items[0].name, 'Sunrise Milk');
});

test('an empty basket is not worth parking', () => {
  const parked = parkDraft(null, emptyBasket(OWNER, NOW), 'Nothing', NOW);
  assert.deepEqual(parked, { ok: false, why: 'empty' });
});

test('picking a draft up removes it from the list', () => {
  const parked = parkDraft(null, basketWith('Sunrise Milk'), 'Milk', NOW);
  if (!parked.ok) throw new Error('park failed');
  const resumed = resumeDraft(parked.state, parked.state.items[0].id, OWNER.ownerId, NOW);
  assert.ok(resumed);
  assert.equal(resumed!.draft.name, 'Milk');
  assert.equal(resumed!.state.items.length, 0);
});

test('drafts age out with the working basket', () => {
  const parked = parkDraft(null, basketWith('Sunrise Milk'), '', NOW);
  if (!parked.ok) throw new Error('park failed');
  const aDayLater = NOW + 24 * 60 * 60_000 + 1;
  assert.equal(draftsFor(parked.state, OWNER.ownerId, aDayLater).length, 0);
  assert.equal(decodeDrafts(encodeDrafts(parked.state), aDayLater), null);
});

test('another person’s drafts are not theirs', () => {
  const parked = parkDraft(null, basketWith('Sunrise Milk'), '', NOW);
  if (!parked.ok) throw new Error('park failed');
  assert.equal(draftsFor(parked.state, 'someone-else', NOW).length, 0);
});

test('throwing one away leaves the rest', () => {
  const first = parkDraft(null, basketWith('Milk'), '', NOW);
  if (!first.ok) throw new Error('park failed');
  const second = parkDraft(first.state, basketWith('Bread'), '', NOW);
  if (!second.ok) throw new Error('park failed');
  const left = dropDraft(second.state, second.state.items[0].id);
  assert.equal(left?.items.length, 1);
});
