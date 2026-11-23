import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkIsForMyShop } from '../src/lib/white-label-link';

test("a shop's own app follows a link to its own shop, however the address is capitalised", () => {
  assert.equal(linkIsForMyShop('palmart', 'palmart'), true);
  assert.equal(linkIsForMyShop('Palmart', 'palmart'), true);
  assert.equal(linkIsForMyShop(' palmart ', 'PALMART'), true);
});

test('it never follows a link to another shop', () => {
  assert.equal(linkIsForMyShop('palmart', 'acme'), false);
  assert.equal(linkIsForMyShop('palmart', 'palmart-two'), false);
  assert.equal(linkIsForMyShop('palmart', ''), false);
  assert.equal(linkIsForMyShop('palmart', null), false);
  assert.equal(linkIsForMyShop('palmart', undefined), false);
});

test('the generic app, which has no shop of its own, never follows a link', () => {
  assert.equal(linkIsForMyShop(null, 'acme'), false);
  assert.equal(linkIsForMyShop(undefined, 'acme'), false);
  assert.equal(linkIsForMyShop('', ''), false);
  assert.equal(linkIsForMyShop(null, null), false);
});
