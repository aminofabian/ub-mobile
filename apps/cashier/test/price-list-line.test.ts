import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceListLine } from '../src/lib/catalog-words';
import type { CopyState } from '../src/lib/catalog-copy';

const NOW = new Date(2026, 10, 25, 18, 0, 0).getTime();
const AT = new Date(2026, 10, 25, 17, 55, 0).getTime();

function state(over: Partial<CopyState> = {}): CopyState {
  return {
    loaded: true,
    open: { items: Array.from({ length: 7 }, (_, i) => ({ id: String(i) })) as never, at: AT, cut: false },
    stored: null,
    found: 'copy',
    saved: true,
    making: null,
    failure: null,
    ...over,
  };
}

test('a price list in order says nothing at all', () => {
  assert.equal(priceListLine(state(), NOW), null);
});

test('the line is a fact and a time, not a paragraph', () => {
  const words = priceListLine(state({ saved: false }), NOW);
  assert.equal(words?.text, '7 products · 17:55 · kept until the app closes');
  assert.equal(words?.warn, true);
});

test('a cut list says so in a line', () => {
  assert.deepEqual(priceListLine(state({ open: { items: Array.from({ length: 7 }, (_, i) => ({ id: String(i) })) as never, at: AT, cut: true } }), NOW), {
    text: '7 products · some not on this phone',
    warn: true,
  });
});

test('saving says how far it has got, and is not a warning', () => {
  assert.deepEqual(priceListLine(state({ making: { scanned: 120, total: 400 } as never }), NOW), {
    text: 'Saving the list… 120/400',
    warn: false,
  });
  assert.deepEqual(priceListLine(state({ making: { scanned: 0, total: null } as never }), NOW), {
    text: 'Saving the list…',
    warn: false,
  });
});

test('a failure is four words and the time of the list still on screen', () => {
  assert.deepEqual(priceListLine(state({ failure: { at: NOW, why: 'no_answer' } as never }), NOW), {
    text: 'No connection · showing 17:55',
    warn: true,
  });
  assert.deepEqual(priceListLine(state({ open: null, failure: { at: NOW, why: 'refused' } as never }), NOW), {
    text: 'The shop refused the list',
    warn: true,
  });
});

test('nothing on the phone yet is said plainly', () => {
  assert.deepEqual(priceListLine(state({ open: null, found: 'nothing' }), NOW), {
    text: 'No price list on this phone yet',
    warn: true,
  });
  // Nothing known before the phone has been read: say nothing.
  assert.equal(priceListLine(state({ loaded: false, open: null }), NOW), null);
});
