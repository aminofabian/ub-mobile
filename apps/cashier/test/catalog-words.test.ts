import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openCatalog, type Catalog } from '../src/lib/catalog';
import { NO_COPY, type CopyState } from '../src/lib/catalog-copy';
import { NO_PRICE_LIST_WORDS, asOfWords, copyLine, fromPhoneWords, priceAgeCaption, whyNoCopy } from '../src/lib/catalog-words';

// Local dates, so these hold in any time zone.
const at = (month: number, day: number, hour: number, minute: number) => new Date(2026, month - 1, day, hour, minute).getTime();
const NOW = at(11, 23, 15, 30);

test('a copy made today says the time, and that it was today', () => {
  assert.equal(asOfWords(at(11, 23, 14, 2), NOW), 'as of 14:02 today');
  assert.equal(asOfWords(at(11, 23, 0, 5), NOW), 'as of 00:05 today');
  assert.equal(asOfWords(at(11, 23, 15, 30), NOW), 'as of 15:30 today');
});

test('a copy made yesterday says so, whatever time of day it was', () => {
  assert.equal(asOfWords(at(11, 22, 17, 40), NOW), 'as of 17:40 yesterday');
  assert.equal(asOfWords(at(11, 22, 23, 59), NOW), 'as of 23:59 yesterday');
  assert.equal(asOfWords(at(11, 22, 0, 0), NOW), 'as of 00:00 yesterday');
});

test('yesterday is the day before, across a month and a year', () => {
  assert.equal(asOfWords(at(10, 31, 9, 15), at(11, 1, 8, 0)), 'as of 09:15 yesterday');
  assert.equal(asOfWords(new Date(2025, 11, 31, 22, 0).getTime(), new Date(2026, 0, 1, 7, 0).getTime()), 'as of 22:00 yesterday');
});

test('an older copy says the day and the time', () => {
  assert.equal(asOfWords(at(11, 21, 9, 15), NOW), 'as of 21 Nov, 09:15');
  assert.equal(asOfWords(at(1, 5, 18, 0), NOW), 'as of 5 Jan, 18:00');
  assert.equal(asOfWords(at(12, 31, 7, 7), NOW), 'as of 31 Dec, 07:07');
});

test('a copy from tomorrow, by the phone\'s clock, still says a day and a time', () => {
  assert.equal(asOfWords(at(11, 24, 8, 0), NOW), 'as of 24 Nov, 08:00');
});

test('a copy with no known time says so', () => {
  for (const unknown of [0, -1, NaN, Infinity]) assert.equal(asOfWords(unknown, NOW), 'as of a time that is not known', String(unknown));
});

test('above the list, the phone\'s copy says it is the phone\'s, when it was made, and that it may have moved', () => {
  const words = fromPhoneWords(at(11, 23, 14, 2), NOW, false);
  assert.match(words, /^No connection\./);
  assert.match(words, /list saved on this phone, as of 14:02 today/);
  assert.match(words, /may have changed/);
  assert.doesNotMatch(words, /not on the phone/);
  assert.match(fromPhoneWords(at(11, 23, 14, 2), NOW, true), /Some products are not on the phone's list, so they cannot be found here\.$/);
});

test('with no list, the till says what to do about it', () => {
  assert.match(NO_PRICE_LIST_WORDS, /no price list saved yet/);
  assert.match(NO_PRICE_LIST_WORDS, /Connect to the internet once/);
});

function catalog(count: number, over: Partial<Catalog> = {}): Catalog {
  return {
    branchId: 'b-1',
    at: at(11, 23, 14, 2),
    cut: false,
    dropped: 0,
    items: Array.from({ length: count }, (_, n) => ({ id: `i-${n}`, name: `P${n}`, sellingPrice: 1 })),
    ...over,
  };
}

const state = (over: Partial<CopyState>): CopyState => ({ ...NO_COPY, loaded: true, ...over });

test('before the phone has been read there is nothing to say', () => {
  assert.equal(copyLine(NO_COPY, NOW), '');
});

test('with no list on the phone, it says so, and says why when one was left that could not be used', () => {
  assert.equal(copyLine(state({}), NOW), 'No price list is saved on this phone yet.');
  assert.match(copyLine(state({ found: 'unreadable' }), NOW), /could not be read, so it will be saved again/);
  assert.match(copyLine(state({ found: 'newer' }), NOW), /newer version of the app/);
  assert.equal(whyNoCopy('nothing'), null);
  assert.equal(whyNoCopy('copy'), null);
});

test('a list that is there says how many products and from when', () => {
  const open = openCatalog(catalog(1820));
  assert.equal(copyLine(state({ open, saved: true }), NOW), 'Price list on this phone: 1,820 products, as of 14:02 today.');
  assert.equal(copyLine(state({ open: openCatalog(catalog(1)), saved: true }), NOW), 'Price list on this phone: 1 product, as of 14:02 today.');
});

test('a list that is cut short, or only in memory, says so', () => {
  assert.match(copyLine(state({ open: openCatalog(catalog(3, { cut: true })), saved: true }), NOW), /more products than the phone keeps/);
  assert.match(copyLine(state({ open: openCatalog(catalog(3)), saved: false }), NOW), /kept only until the app closes\.$/);
});

test('while a list is being saved, the line says how far it has got', () => {
  assert.equal(copyLine(state({ making: { scanned: 750, total: 1820 } }), NOW), 'Saving the price list on this phone: 750 of 1,820...');
  assert.equal(copyLine(state({ making: { scanned: 5, total: null } }), NOW), 'Saving the price list on this phone...');
  assert.equal(copyLine(state({ making: { scanned: 0, total: 0 } }), NOW), 'Saving the price list on this phone...');
  assert.equal(copyLine(state({ making: { scanned: 1900, total: 1820 } }), NOW), 'Saving the price list on this phone: 1,820 of 1,820...', 'never more than the whole');
});

test('while a list is being saved, that is what is said, even when an older one is there', () => {
  const open = openCatalog(catalog(3));
  assert.match(copyLine(state({ open, making: { scanned: 1, total: 9 }, failure: { at: NOW, why: 'no_answer' } }), NOW), /^Saving the price list/);
});

test('a list that could not be saved says why, and that the earlier one is still there', () => {
  const open = openCatalog(catalog(3));
  const kinds = { no_answer: /no connection to the shop/, refused: /may look products up/, nothing: /no products that can be sold/, other: /Could not save the price list just now\./ } as const;
  for (const [why, pattern] of Object.entries(kinds) as [keyof typeof kinds, RegExp][]) {
    assert.match(copyLine(state({ failure: { at: NOW, why } }), NOW), pattern, why);
    assert.doesNotMatch(copyLine(state({ failure: { at: NOW, why } }), NOW), /saved earlier/, why);
    assert.match(copyLine(state({ open, failure: { at: NOW, why } }), NOW), /The list saved earlier is still here, as of 14:02 today\.$/, why);
  }
});

test('what the Payment screen says about prices that came from the phone: when the list was made, and what may follow', () => {
  const words = priceAgeCaption(at(11, 23, 7, 5), NOW);
  assert.match(words, /^Some prices in this sale are from the list saved on this phone, as of 07:05 today\./);
  assert.match(words, /the server may not accept the sale when it is sent/);
  assert.match(words, /a manager will have to look at it\.$/);
  assert.match(priceAgeCaption(at(11, 22, 18, 0), NOW), /as of 18:00 yesterday/);
  assert.match(priceAgeCaption(NaN, NOW), /as of a time that is not known/);
});
