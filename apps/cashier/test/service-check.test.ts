import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CartLine } from '../src/lib/cart';
import { BOOK_FRESH_MS, bookIsFresh, changesIn, describeChanges, servicesChangedBeforePay, type CheckDeps } from '../src/lib/service-check';
import { parsePerformers, parseServices, planService, type Choice, type Service, type ServiceBook } from '../src/lib/service-sale';

const ROWS = [
  { id: 's-cut', name: 'Haircut', price: 300, priceIsVariable: false, active: true, staffProfileIds: ['p-1'], options: [] },
  {
    id: 's-braids',
    name: 'Braids',
    price: 1500,
    priceIsVariable: false,
    active: true,
    staffProfileIds: [],
    options: [
      { id: 'g-len', name: 'Length', required: true, multiple: false, options: [{ id: 'long', name: 'Long', priceDelta: 500 }, { id: 'short', name: 'Short', priceDelta: 0 }] },
    ],
  },
  { id: 's-col', name: 'Colour', price: 0, priceIsVariable: true, active: true, staffProfileIds: [], options: [] },
];
const PEOPLE = [
  { staffProfileId: 'p-1', displayName: 'Wanjiku' },
  { staffProfileId: 'p-2', displayName: 'Otieno' },
];
const NOON = Date.UTC(2026, 10, 24, 9, 0, 0);

function bookOf(rows: readonly Record<string, unknown>[] = ROWS, people: readonly Record<string, unknown>[] = PEOPLE, asOf = NOON): ServiceBook {
  return { tenantId: 't-1', services: parseServices(rows), performers: parsePerformers(people), asOf };
}
function service(book: ServiceBook, id: string): Service {
  const found = book.services.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no service ${id}`);
  return found;
}
/** The line the cashier added, from the list as it was then. */
function added(book: ServiceBook, id: string, over: Partial<Choice> = {}): CartLine {
  const one = service(book, id);
  const choice: Choice = { performerId: 'p-1', optionIds: [], quantity: 1, typedCents: null, ...over };
  const plan = planService(one, book.performers, choice);
  if (!plan.ok) throw new Error(plan.why);
  return plan.line;
}
const row = (id: string, over: Record<string, unknown>) => ROWS.map((one) => (one.id === id ? { ...one, ...over } : one));

test('a list read a moment ago is good enough, and one read long ago, or in the future, is not', () => {
  const book = bookOf();
  assert.equal(bookIsFresh(book, NOON), true);
  assert.equal(bookIsFresh(book, NOON + BOOK_FRESH_MS - 1), true);
  assert.equal(bookIsFresh(book, NOON + BOOK_FRESH_MS), false);
  assert.equal(bookIsFresh(book, NOON - 1), false, 'a clock that was set back');
  assert.equal(bookIsFresh(null, NOON), false);
  assert.equal(BOOK_FRESH_MS, 120_000);
});

test('a basket whose services are as the shop lists them has nothing to say', () => {
  const book = bookOf();
  const cart = [
    added(book, 's-cut'),
    added(book, 's-braids', { performerId: 'p-2', optionIds: ['long'] }),
    added(book, 's-col', { typedCents: 250000 }),
  ];
  assert.deepEqual(changesIn(cart, book), []);
  assert.equal(describeChanges([]), '');
});

test('a line that is not a service is not looked at', () => {
  const milk: CartLine = { itemId: 'i-1', name: 'Milk', quantity: 1, unitPrice: 65 };
  assert.deepEqual(changesIn([milk], bookOf([], [])), []);
});

test('a service the shop no longer lists is found', () => {
  const book = bookOf();
  const cart = [added(book, 's-cut')];
  const now = bookOf(ROWS.filter((one) => one.id !== 's-cut'));
  assert.deepEqual(changesIn(cart, now), [{ kind: 'gone', itemId: cart[0]?.itemId, name: 'Haircut', performerName: 'Wanjiku' }]);
});

test('a service that was switched off is gone too, because the till does not read the ones that are off', () => {
  const book = bookOf();
  const cart = [added(book, 's-cut')];
  assert.equal(changesIn(cart, bookOf(row('s-cut', { active: false })))[0]?.kind, 'gone');
});

test('a person who may no longer do the service, or who is no longer on the staff, is found', () => {
  const book = bookOf();
  const cart = [added(book, 's-cut')];
  // The haircut is now done by p-2 only.
  assert.equal(changesIn(cart, bookOf(row('s-cut', { staffProfileIds: ['p-2'] })))[0]?.kind, 'person');
  // p-1 is no longer one of the staff who can be named.
  assert.equal(changesIn(cart, bookOf(ROWS, [PEOPLE[1] as Record<string, unknown>]))[0]?.kind, 'person');
  // A service that names no one is done by anyone who is on the list.
  const braids = [added(book, 's-braids', { performerId: 'p-2', optionIds: ['short'] })];
  assert.deepEqual(changesIn(braids, bookOf()), []);
  assert.equal(changesIn(braids, bookOf(ROWS, [PEOPLE[0] as Record<string, unknown>]))[0]?.kind, 'person');
});

test('a choice that is no longer on the service is found', () => {
  const book = bookOf();
  const cart = [added(book, 's-braids', { optionIds: ['long'] })];
  const without = row('s-braids', { options: [{ id: 'g-len', name: 'Length', required: true, multiple: false, options: [{ id: 'short', name: 'Short', priceDelta: 0 }] }] });
  assert.equal(changesIn(cart, bookOf(without))[0]?.kind, 'choice');
});

test('a price that is no longer the service\'s is found, whether the service or a choice on it changed', () => {
  const book = bookOf();
  const cut = [added(book, 's-cut')];
  assert.equal(changesIn(cut, bookOf(row('s-cut', { price: 350 })))[0]?.kind, 'price');
  assert.equal(changesIn(cut, bookOf(row('s-cut', { price: 250 })))[0]?.kind, 'price');
  const braids = [added(book, 's-braids', { optionIds: ['long'] })];
  const dearer = row('s-braids', { options: [{ id: 'g-len', name: 'Length', required: true, multiple: false, options: [{ id: 'long', name: 'Long', priceDelta: 700 }, { id: 'short', name: 'Short', priceDelta: 0 }] }] });
  assert.equal(changesIn(braids, bookOf(dearer))[0]?.kind, 'price');
});

test('the price is compared to the cent, so a price that only looks the same as a sum of shillings is the same', () => {
  const book = bookOf(row('s-cut', { price: 0.1, options: [{ id: 'g', name: 'G', required: false, multiple: false, options: [{ id: 'o', name: 'O', priceDelta: 0.2 }] }] }));
  const cart = [added(book, 's-cut', { optionIds: ['o'] })];
  assert.equal(cart[0]?.unitPrice, 0.3);
  assert.deepEqual(changesIn(cart, book), []);
});

test('a service with a price set at the till is not compared on price, the server takes any price above zero for it', () => {
  const book = bookOf();
  const cart = [added(book, 's-col', { typedCents: 250000 })];
  assert.deepEqual(changesIn(cart, bookOf(row('s-col', { price: 900 }))), []);
  // But when the shop gave it a fixed price, the price that was typed is no longer one the server takes.
  assert.equal(changesIn(cart, bookOf(row('s-col', { priceIsVariable: false, price: 900 })))[0]?.kind, 'price');
});

test('each line is found once, for the first thing the server would turn down, and the others stay out of it', () => {
  const book = bookOf();
  const cart = [added(book, 's-cut'), added(book, 's-braids', { optionIds: ['long'] }), added(book, 's-col', { typedCents: 5000 })];
  const now = bookOf(row('s-cut', { price: 999, staffProfileIds: ['p-2'] }).filter((one) => one.id !== 's-col'));
  const found = changesIn(cart, now);
  assert.deepEqual(found.map((change) => [change.name, change.kind]), [['Haircut', 'person'], ['Colour', 'gone']]);
});

test('the words say what changed, name the line and the person, and tell the cashier what to do', () => {
  const book = bookOf();
  const cart = [added(book, 's-cut')];
  const one = describeChanges(changesIn(cart, bookOf(row('s-cut', { price: 350 }))));
  assert.equal(one, 'A service in the basket has changed in the shop: Haircut has a different price now. Take it out of the basket and add it again from Services.');
  assert.equal(
    describeChanges(changesIn(cart, bookOf(row('s-cut', { staffProfileIds: ['p-2'] })))),
    'A service in the basket has changed in the shop: Haircut is no longer done by Wanjiku. Take it out of the basket and add it again from Services.'
  );
  assert.match(describeChanges(changesIn(cart, bookOf(ROWS.filter((s) => s.id !== 's-cut')))), /Haircut is not sold any more/);
  const braids = [added(book, 's-braids', { optionIds: ['long'] })];
  const bare = row('s-braids', { options: [{ id: 'g-len', name: 'Length', required: true, multiple: false, options: [{ id: 'short', name: 'Short', priceDelta: 0 }] }] });
  assert.match(describeChanges(changesIn(braids, bookOf(bare))), /Braids \(Long\) no longer has what was chosen on it/);
});

test('a service the shop no longer sells is only taken out: it cannot be added again', () => {
  const book = bookOf();
  const cart = [added(book, 's-cut')];
  const words = describeChanges(changesIn(cart, bookOf(ROWS.filter((s) => s.id !== 's-cut'))));
  assert.equal(words, 'A service in the basket has changed in the shop: Haircut is not sold any more. Take it out of the basket.');
  // All of them gone, however many: still only taken out.
  const both = [added(book, 's-cut'), added(book, 's-braids', { optionIds: ['short'] })];
  assert.equal(
    describeChanges(changesIn(both, bookOf([]))),
    'Services in the basket have changed in the shop: Haircut is not sold any more; Braids (Short) is not sold any more. Take them out of the basket.'
  );
});

test('when some are gone and some can be added again, the words say which is which', () => {
  const book = bookOf();
  const cart = [added(book, 's-cut'), added(book, 's-braids', { optionIds: ['long'] })];
  const now = bookOf(ROWS.filter((s) => s.id !== 's-cut').map((s) => (s.id === 's-braids' ? { ...s, price: 1600 } : s)));
  const words = describeChanges(changesIn(cart, now));
  assert.match(words, /Haircut is not sold any more; Braids \(Long\) has a different price now\./);
  assert.match(words, /Take them out of the basket, and add again from Services the ones that are still sold\.$/);
});

test('several changes are named, at most three, and counted after that', () => {
  const rows = Array.from({ length: 5 }, (_, n) => ({ id: `s${n}`, name: `Service ${n}`, price: 100, priceIsVariable: false, active: true, staffProfileIds: [], options: [] }));
  const book = bookOf(rows);
  const cart = rows.map((one) => added(book, one.id));
  const now = bookOf(rows.map((one) => ({ ...one, price: 200 })));
  const words = describeChanges(changesIn(cart, now));
  assert.equal(
    words,
    'Services in the basket have changed in the shop: Service 0 has a different price now; Service 1 has a different price now; Service 2 has a different price now; and 2 more. Take them out of the basket and add them again from Services.'
  );
  assert.doesNotMatch(words, /Service 3|Service 4/);
  // Exactly three are all named, and nothing is said to be more.
  const three = describeChanges(changesIn(cart.slice(0, 3), now));
  assert.match(three, /Service 2 has a different price now\. Take them out/);
  assert.doesNotMatch(three, /more/);
});

// ---- the check before payment

/** A till in which the list it holds was read at `NOON`, ten minutes ago, and every call is counted. */
function till(spec: { cart: CartLine[]; held?: ServiceBook | null; shop?: ServiceBook | 'silent' | 'refuses'; offline?: () => boolean; now?: () => number }) {
  const calls = { read: 0, kept: [] as ServiceBook[] };
  const deps: CheckDeps = {
    cart: () => spec.cart,
    held: () => (spec.held === undefined ? bookOf() : spec.held),
    offline: spec.offline ?? (() => false),
    read: async () => {
      calls.read += 1;
      if (spec.shop === 'silent') throw new Error('no answer in time');
      if (spec.shop === 'refuses') throw new Error('refused');
      return spec.shop ?? bookOf(ROWS, PEOPLE, NOON + 10 * 60_000);
    },
    keep: (book) => calls.kept.push(book),
    now: spec.now ?? (() => NOON + 10 * 60_000),
  };
  return { deps, calls };
}

test('a list read a moment ago is used, and the shop is not asked', async () => {
  const cart = [added(bookOf(), 's-cut')];
  const { deps, calls } = till({ cart, held: bookOf(ROWS, PEOPLE, NOON + 9 * 60_000), now: () => NOON + 10 * 60_000 });
  assert.deepEqual(await servicesChangedBeforePay(deps), []);
  assert.equal(calls.read, 0);
});

test('an older list is read again, kept, and what the shop says now is what the basket is held against', async () => {
  const cart = [added(bookOf(), 's-cut')];
  const shop = bookOf(row('s-cut', { price: 350 }), PEOPLE, NOON + 10 * 60_000);
  const { deps, calls } = till({ cart, shop });
  const found = await servicesChangedBeforePay(deps);
  assert.deepEqual(found.map((change) => [change.name, change.kind]), [['Haircut', 'price']]);
  assert.equal(calls.read, 1);
  assert.deepEqual(calls.kept, [shop], 'the list that was read is kept');
});

test('a till with no list at all asks the shop, and has nothing to say when it does not answer', async () => {
  const cart = [added(bookOf(), 's-cut')];
  const asked = till({ cart, held: null });
  assert.deepEqual(await servicesChangedBeforePay(asked.deps), []);
  assert.equal(asked.calls.read, 1);
  const silent = till({ cart, held: null, shop: 'silent' });
  assert.deepEqual(await servicesChangedBeforePay(silent.deps), []);
  assert.deepEqual(silent.calls.kept, []);
});

test('when the shop cannot be asked, or does not answer, the till goes on with the list it holds', async () => {
  const cart = [added(bookOf(), 's-cut')];
  // The list it holds is the one the line was added from, so nothing is found: the server still checks the sale.
  for (const shop of ['silent', 'refuses'] as const) {
    const { deps, calls } = till({ cart, shop });
    assert.deepEqual(await servicesChangedBeforePay(deps), [], shop);
    assert.equal(calls.read, 1);
    assert.deepEqual(calls.kept, []);
  }
  // A list the till holds that already says the service changed is still believed.
  const stale = bookOf(row('s-cut', { price: 350 }), PEOPLE, NOON);
  const { deps } = till({ cart, held: stale, shop: 'silent' });
  assert.equal((await servicesChangedBeforePay(deps))[0]?.kind, 'price');
});

test('a till that believes the shop is out of reach does not ask it', async () => {
  const cart = [added(bookOf(), 's-cut')];
  const { deps, calls } = till({ cart, offline: () => true });
  assert.deepEqual(await servicesChangedBeforePay(deps), []);
  assert.equal(calls.read, 0);
});

test('the basket that is checked is the one in front of the cashier after the wait, not the one before it', async () => {
  const before = [added(bookOf(), 's-cut')];
  const after = [added(bookOf(), 's-braids', { optionIds: ['long'] })];
  let current = before;
  const shop = bookOf(row('s-cut', { price: 350 }), PEOPLE, NOON + 10 * 60_000);
  const { deps } = till({ cart: before, shop });
  // The cashier takes the haircut out and adds braids while the shop is being asked.
  const found = await servicesChangedBeforePay({
    ...deps,
    cart: () => current,
    read: async () => {
      current = after;
      return shop;
    },
  });
  assert.deepEqual(found, [], 'the haircut that changed is no longer in the basket');
});

test('a basket with no service in it is never a reason to ask the shop for anything', async () => {
  const milk: CartLine = { itemId: 'i-1', name: 'Milk', quantity: 1, unitPrice: 65 };
  const { deps } = till({ cart: [milk] });
  assert.deepEqual(await servicesChangedBeforePay(deps), []);
});
