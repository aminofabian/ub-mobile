import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { MAX_UNITS } from '../src/lib/cart';
import { parseServices } from '../src/lib/service-sale';
import {
  NO_ONE_DOES_WORDS,
  NO_PERFORMERS_WORDS,
  NO_SERVICES_WORDS,
  SERVICE_NOT_ADDED_WORDS,
  describeServicesFailure,
  priceBoxWords,
  serviceAddedWords,
  servicesFromPhoneWords,
  servicesView,
  checkoutWords,
  sharedNamesWords,
  sumWords,
} from '../src/lib/service-words';

test('the stale-list words say when the list was read, and that a changed price is turned down when the sale is sent', () => {
  const read = new Date(2026, 10, 24, 9, 5).getTime();
  const words = servicesFromPhoneWords(read);
  assert.ok(words.includes('24 Nov, 09:05'), words);
  assert.match(words, /shop did not answer/);
  assert.match(words, /not accepted when the sale is sent/);
});

test('the words for a line that could not be added name the limit the basket really has', () => {
  assert.ok(SERVICE_NOT_ADDED_WORDS.includes(MAX_UNITS.toLocaleString('en-US')), SERVICE_NOT_ADDED_WORDS);
});

test('the words after adding a service say what and who', () => {
  assert.equal(serviceAddedWords('Braids (Long)', 'Wanjiku'), 'Added Braids (Long), done by Wanjiku.');
});

test('what the till says about services is plain: no codes, no jargon, and the owner is told where to fix it', () => {
  const said = [NO_SERVICES_WORDS, NO_PERFORMERS_WORDS, NO_ONE_DOES_WORDS, SERVICE_NOT_ADDED_WORDS, describeServicesFailure(null), describeServicesFailure(new Error('x'))];
  for (const words of said) {
    assert.doesNotMatch(words, /\b(API|HTTP|JSON|null|undefined|NaN|400|403|500)\b/, words);
  }
  assert.match(NO_SERVICES_WORDS, /owner/);
  assert.match(NO_PERFORMERS_WORDS, /owner/);
  assert.match(NO_ONE_DOES_WORDS, /owner/);
});

// ---- the price box and the sum

const row = (over: Record<string, unknown> = {}) => ({
  id: 's-1',
  name: 'Braids',
  price: 1000,
  priceIsVariable: true,
  active: true,
  staffProfileIds: [],
  options: [{ id: 'g', name: 'Length', required: false, multiple: false, options: [{ id: 'long', name: 'Long', priceDelta: 500 }, { id: 'short', name: 'Short', priceDelta: 0 }] }],
  ...over,
});
const service = (over: Record<string, unknown> = {}) => {
  const [one] = parseServices([row(over)]);
  assert.ok(one);
  return one;
};

test('the price box asks for the price before the extras when a choice adds money, and shows the listed price while it is empty', () => {
  assert.deepEqual(priceBoxWords(service()), { heading: 'Price before extras', placeholder: '1,000.00' });
});

test('the price box is the price of one when nothing chosen adds money, and says to enter it when none is listed', () => {
  const free = service({ options: [{ id: 'g', name: 'Length', required: false, multiple: false, options: [{ id: 'short', name: 'Short', priceDelta: 0 }] }] });
  assert.equal(priceBoxWords(free).heading, 'Price for one');
  assert.equal(priceBoxWords(service({ options: [] })).heading, 'Price for one');
  const unpriced = service({ price: 0 });
  assert.deepEqual(priceBoxWords(unpriced), { heading: 'Price before extras', placeholder: 'Enter the price' });
});

test('the sum is shown only when what was chosen adds something', () => {
  assert.equal(sumWords({ baseCents: 100000, extrasCents: 50000, unitCents: 150000 }), 'KES 1,000.00 + 500.00 extras = 1,500.00 each');
  assert.equal(sumWords({ baseCents: 100000, extrasCents: 0, unitCents: 100000 }), null);
  assert.equal(sumWords(null), null);
});

test('people who share a name are told to take care, with the names', () => {
  assert.equal(sharedNamesWords([]), null);
  assert.equal(sharedNamesWords(['Peter']), 'More than one person here is called Peter. Check that you pick the right one.');
  assert.equal(
    sharedNamesWords(['Peter', 'Mary']),
    'Each of these names belongs to more than one person here: Peter, Mary. Check that you pick the right one.'
  );
  // Few are named, the rest are counted.
  assert.equal(
    sharedNamesWords(['A', 'B', 'C', 'D']),
    'Each of these names belongs to more than one person here: A, B, C, D. Check that you pick the right one.'
  );
  assert.equal(
    sharedNamesWords(['A', 'B', 'C', 'D', 'E', 'F']),
    'Each of these names belongs to more than one person here: A, B, C, D, and 2 more. Check that you pick the right one.'
  );
});

test('the Checkout button says that the till is looking at the shop, and then says Checkout again', () => {
  assert.equal(checkoutWords(false), 'Checkout');
  assert.equal(checkoutWords(true), 'Checking...');
});

// ---- what the services screen shows

const BOOK = { asOf: 1_700_000_000_000, services: 3, performers: 2 };
const view = (over: Partial<Parameters<typeof servicesView>[0]> = {}) => servicesView({ book: BOOK, shown: 3, typed: '', loading: false, failed: null, ...over });

test('a list that is read and fine shows no warning and no placeholder text', () => {
  assert.deepEqual(view(), { above: null, noPerformers: false, instead: null });
});

test('the first read shows "Loading", never a failure, and a read that failed says so with a way to try again', () => {
  assert.deepEqual(view({ book: null, shown: 0, loading: true }).instead, { kind: 'loading', words: 'Loading...' });
  assert.equal(view({ book: null, shown: 0, loading: true, failed: { error: new Error('earlier') } }).instead?.kind, 'loading', 'reading again says so, not what went wrong before');
  const failed = view({ book: null, shown: 0, failed: { error: new Error('timeout') } });
  assert.equal(failed.instead?.kind, 'failed');
  assert.match(failed.instead?.words ?? '', /has not kept a list yet/);
  const refused = view({ book: null, shown: 0, failed: { error: new ApiError('Forbidden', { status: 403 }) } });
  assert.match(refused.instead?.words ?? '', /not allowed to see the services/);
});

test('when the shop does not answer, the list read before is shown with the time it was read', () => {
  const said = view({ failed: { error: new Error('timeout') } });
  assert.equal(said.above?.kind, 'old');
  assert.match(said.above?.words ?? '', /shop did not answer/);
  assert.equal(view({ failed: { error: new ApiError('Bad gateway', { status: 502 }) } }).above?.kind, 'old');
});

test('when the shop answers with a refusal, that is said, not "did not answer"', () => {
  const forbidden = view({ failed: { error: new ApiError('Forbidden', { status: 403 }) } });
  assert.equal(forbidden.above?.kind, 'problem');
  assert.match(forbidden.above?.words ?? '', /not allowed to see the services/);
  const broken = view({ failed: { error: new ApiError('Server error', { status: 500 }) } });
  assert.equal(broken.above?.kind, 'problem');
  assert.doesNotMatch(broken.above?.words ?? '', /did not answer/);
  assert.match(broken.above?.words ?? '', /list below is the one read earlier/);
});

test('a shop with services but no one to name on them is told so, and one with no services says that', () => {
  assert.equal(view({ book: { ...BOOK, performers: 0 } }).noPerformers, true);
  assert.equal(view({ book: { ...BOOK, performers: 1 } }).noPerformers, false, 'one person is enough');
  assert.equal(view({ book: { ...BOOK, services: 0, performers: 0 }, shown: 0 }).noPerformers, false, 'nothing to sell, so nothing to say about who sells it');
  assert.deepEqual(view({ book: { ...BOOK, services: 0 }, shown: 0 }).instead, { kind: 'none', words: NO_SERVICES_WORDS });
});

test('a search that finds nothing says what was searched for, cleaned', () => {
  const nothing = view({ shown: 0, typed: '  zz\u200b  zz ' });
  assert.deepEqual(nothing.instead, { kind: 'nomatch', words: 'No service has "zz zz" in its name.' });
  assert.equal(view({ shown: 0, typed: 'x'.repeat(500) }).instead?.words, `No service has "${'x'.repeat(40)}" in its name.`);
});
