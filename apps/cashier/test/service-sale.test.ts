import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addUnit,
  backToShelf,
  cartCents,
  lineWords,
  onShelfPrice,
  removeLine,
  setLinePrice,
  setUnits,
  MAX_UNITS,
  SERVICE_ID_PREFIX,
  type CartItem,
  type CartLine,
} from '../src/lib/cart';
import { fromCents, MAX_TYPED_CENTS } from '../src/lib/money';
import {
  addService,
  baseCents,
  breakdownFor,
  describeServiceLine,
  durationWords,
  extrasCents,
  listedCents,
  MAX_CHOSEN_OPTIONS,
  MAX_SERVICE_QUANTITY,
  parsePerformers,
  parseServices,
  performersFor,
  planService,
  priceFor,
  priceWords,
  searchServices,
  sharedNames,
  startChoice,
  toggleOption,
  type Choice,
  type Performer,
  type Service,
} from '../src/lib/service-sale';

const BRAIDS_ROW = {
  id: 's-braids',
  categoryId: 'c-1',
  name: 'Braids',
  description: 'Plaits',
  durationMinutes: 90,
  price: 1500,
  priceIsVariable: false,
  commissionType: null,
  commissionValue: null,
  sortOrder: 1,
  active: true,
  staffProfileIds: [],
  version: 3,
  productCost: null,
  imageUrl: null,
  options: [
    {
      id: 'len',
      name: 'Length',
      required: true,
      multiple: false,
      options: [
        { id: 'short', name: 'Short', priceDelta: 0, extraMinutes: 0 },
        { id: 'long', name: 'Long', priceDelta: 500, extraMinutes: 60 },
      ],
    },
    {
      id: 'ext',
      name: 'Extras',
      required: false,
      multiple: true,
      options: [
        { id: 'packs', name: 'Extra packs', priceDelta: 200.5, extraMinutes: 15 },
        { id: 'wash', name: 'Wash', priceDelta: 100, extraMinutes: 10 },
      ],
    },
  ],
};
const CUT_ROW = { id: 's-cut', name: 'Haircut', durationMinutes: 30, price: 300, priceIsVariable: false, active: true, staffProfileIds: ['p-1'], options: [] };
const COLOUR_ROW = { id: 's-col', name: 'Colour', durationMinutes: 60, price: 0, priceIsVariable: true, active: true, staffProfileIds: [], options: [] };
const PERFORMER_ROWS = [
  { staffProfileId: 'p-1', displayName: 'Wanjiku' },
  { staffProfileId: 'p-2', displayName: 'Otieno' },
];

const SERVICES = parseServices([BRAIDS_ROW, CUT_ROW, COLOUR_ROW]);
const PERFORMERS = parsePerformers(PERFORMER_ROWS);
const BRAIDS = SERVICES[0] as Service;
const CUT = SERVICES[1] as Service;
const COLOUR = SERVICES[2] as Service;

function pick(service: Service, patch: Partial<Choice> = {}): Choice {
  return { performerId: 'p-1', optionIds: [], quantity: 1, typedCents: null, ...patch };
}

function planned(service: Service, choice: Choice): CartLine {
  const plan = planService(service, PERFORMERS, choice);
  assert.equal(plan.ok, true, plan.ok ? '' : plan.why);
  return (plan as { ok: true; line: CartLine }).line;
}

function refused(service: Service, choice: Choice): string {
  const plan = planService(service, PERFORMERS, choice);
  assert.equal(plan.ok, false);
  return plan.ok ? '' : plan.why;
}

// ---- reading what the server lists

test('a service is read with its price in cents, who may do it and what can be chosen', () => {
  assert.equal(SERVICES.length, 3);
  assert.deepEqual(BRAIDS, {
    id: 's-braids',
    name: 'Braids',
    durationMinutes: 90,
    priceCents: 150000,
    variablePrice: false,
    performerIds: [],
    groups: [
      {
        id: 'len',
        name: 'Length',
        required: true,
        multiple: false,
        options: [
          { id: 'short', name: 'Short', extraCents: 0 },
          { id: 'long', name: 'Long', extraCents: 50000 },
        ],
      },
      {
        id: 'ext',
        name: 'Extras',
        required: false,
        multiple: true,
        options: [
          { id: 'packs', name: 'Extra packs', extraCents: 20050 },
          { id: 'wash', name: 'Wash', extraCents: 10000 },
        ],
      },
    ],
  });
  assert.deepEqual(CUT.performerIds, ['p-1']);
  assert.equal(COLOUR.variablePrice, true);
  assert.equal(COLOUR.priceCents, 0);
});

test('names are cleaned of what lets them read as something else', () => {
  const [service] = parseServices([{ ...CUT_ROW, name: '  Hair​cut‮\n ', options: [{ id: 'g', name: 'Style​', required: false, multiple: false, options: [{ id: 'o', name: 'Fade‮', priceDelta: 0 }] }] }]);
  assert.equal(service?.name, 'Haircut');
  assert.equal(service?.groups[0]?.name, 'Style');
  assert.equal(service?.groups[0]?.options[0]?.name, 'Fade');
  assert.deepEqual(parsePerformers([{ staffProfileId: 'p-9', displayName: 'Ann​‮' }]), [{ id: 'p-9', name: 'Ann' }]);
});

test('a name of a million characters is cut before it is cleaned, and comes out at the length that is kept', () => {
  const [service] = parseServices([{ ...CUT_ROW, name: 'x'.repeat(1_000_000), options: [{ id: 'g', name: 'y'.repeat(1_000_000), required: false, multiple: false, options: [{ id: 'o', name: 'z'.repeat(1_000_000), priceDelta: 0 }] }] }]);
  assert.equal(service?.name, 'x'.repeat(120));
  assert.equal(service?.groups[0]?.name, 'y'.repeat(60));
  assert.equal(service?.groups[0]?.options[0]?.name, 'z'.repeat(60));
  assert.equal(parsePerformers([{ staffProfileId: 'p', displayName: 'q'.repeat(1_000_000) }])[0]?.name, 'q'.repeat(60));
});

test('a row the till cannot sell as listed is left out, never repaired', () => {
  const rows = [
    { ...CUT_ROW, id: 'a1', active: false },
    { ...CUT_ROW, id: 'a10', active: undefined },
    { ...CUT_ROW, id: 'a11', active: 'yes' },
    { ...CUT_ROW, id: 'a2', name: '   ' },
    { ...CUT_ROW, id: 'a3', price: 0 },
    { ...CUT_ROW, id: 'a4', price: -5 },
    { ...CUT_ROW, id: 'a5', price: 'free' },
    { ...CUT_ROW, id: 'a6', price: null },
    { ...CUT_ROW, id: 'a7', price: 1e12 },
    { ...CUT_ROW, id: 'a8', price: Number.POSITIVE_INFINITY },
    { ...CUT_ROW, id: 'a9', price: Number.NaN },
    { ...CUT_ROW, id: 'bad id' },
    { ...CUT_ROW, id: 'a:b' },
    { ...CUT_ROW, id: 'x'.repeat(65) },
    { ...CUT_ROW, id: undefined },
    null,
    'text',
    7,
    [],
    { ...CUT_ROW, id: 'ok' },
  ];
  assert.deepEqual(
    parseServices(rows).map((service) => service.id),
    ['ok']
  );
});

test('a variable-price service may be listed at nothing, and a fixed one may not', () => {
  assert.equal(parseServices([{ ...COLOUR_ROW, price: null }]).length, 1);
  assert.equal(parseServices([{ ...COLOUR_ROW, price: 0 }])[0]?.priceCents, 0);
  assert.equal(parseServices([{ ...COLOUR_ROW, priceIsVariable: false }]).length, 0);
});

test('a service listed twice is read once, and the server order is kept', () => {
  const read = parseServices([{ ...CUT_ROW, id: 'b' }, { ...CUT_ROW, id: 'a' }, { ...CUT_ROW, id: 'b', name: 'Other' }]);
  assert.deepEqual(read.map((service) => [service.id, service.name]), [['b', 'Haircut'], ['a', 'Haircut']]);
});

test('the list of who may do a service is never read as "anyone" by mistake', () => {
  assert.deepEqual(parseServices([{ ...CUT_ROW, staffProfileIds: [] }])[0]?.performerIds, []);
  // Something that is not a list, or no list at all, is not "anyone" either: the server always sends one.
  for (const staffProfileIds of [undefined, null, 'p-1', {}, 7, true]) {
    assert.equal(parseServices([{ ...CUT_ROW, staffProfileIds }]).length, 0, String(staffProfileIds));
  }
  // Names that cannot be read leave a list that would mean everyone: the service is not offered.
  assert.equal(parseServices([{ ...CUT_ROW, staffProfileIds: [null, 7, 'a b'] }]).length, 0);
  // Some readable: only those may do it.
  assert.deepEqual(parseServices([{ ...CUT_ROW, staffProfileIds: ['p-1', null, 'p-2'] }])[0]?.performerIds, ['p-1', 'p-2']);
});

test('a service that names far more people than there are staff is cut, and the cut never offers more people', () => {
  const crowd = Array.from({ length: 100_000 }, (_, n) => `p${n}`);
  const ids = parseServices([{ ...CUT_ROW, staffProfileIds: crowd }])[0]?.performerIds ?? [];
  assert.equal(ids.length, 500);
  assert.equal(ids[0], 'p0');
  assert.equal(ids[499], 'p499');
  // Names that cannot be read never turn a list into "anyone": the service is either not offered, or offered to the
  // people who were named and could be read.
  const filler = [...Array.from({ length: 600 }, () => null), 'p-1'];
  const offered = parseServices([{ ...CUT_ROW, staffProfileIds: filler }]);
  assert.ok(offered.length === 0 || (offered[0]?.performerIds.length ?? 0) > 0);
});

test('a question nobody can answer is left out, unless it had to be answered', () => {
  const unreadable = { id: 'g1', name: 'Style', required: false, multiple: false, options: [{ id: 'bad id', name: 'X', priceDelta: 0 }] };
  assert.deepEqual(parseServices([{ ...CUT_ROW, options: [unreadable] }])[0]?.groups, []);
  assert.equal(parseServices([{ ...CUT_ROW, options: [{ ...unreadable, required: true }] }]).length, 0);
  assert.equal(parseServices([{ ...CUT_ROW, options: [{ ...unreadable, required: true, options: [] }] }]).length, 0);
});

test('an option with a charge the till cannot read is not offered; one with no charge is free', () => {
  const group = {
    id: 'g1',
    name: 'Extras',
    required: false,
    multiple: true,
    options: [
      { id: 'o1', name: 'Free', priceDelta: null },
      { id: 'o2', name: 'Free too' },
      { id: 'o3', name: 'Odd', priceDelta: 'a lot' },
      { id: 'o4', name: 'Negative', priceDelta: -10 },
      { id: 'o5', name: 'Paid', priceDelta: 25.5 },
      { id: 'o6', name: '   ', priceDelta: 5 },
      { id: 'o7', name: 'Huge', priceDelta: 1e12 },
      { id: 'o8', name: 'Minutes', priceDelta: 1, extraMinutes: -5 },
      { id: 'o9', name: 'Words', priceDelta: 1, extraMinutes: 'long' },
    ],
  };
  const [service] = parseServices([{ ...CUT_ROW, options: [group] }]);
  assert.deepEqual(service?.groups[0]?.options.map((option) => [option.id, option.extraCents]), [['o1', 0], ['o2', 0], ['o5', 2550], ['o8', 100], ['o9', 100]]);
  assert.equal(Object.hasOwn(service?.groups[0]?.options[3] ?? {}, 'extraMinutes'), false, 'the time an option adds is not read: nothing here uses it');
});

test('an id used twice on one service is refused, because the server would count it twice', () => {
  const twice = [
    { id: 'g1', name: 'A', required: false, multiple: false, options: [{ id: 'o1', name: 'One', priceDelta: 0 }] },
    { id: 'g2', name: 'B', required: false, multiple: false, options: [{ id: 'o1', name: 'Other one', priceDelta: 50 }] },
  ];
  assert.equal(parseServices([{ ...CUT_ROW, options: twice }]).length, 0);
  const sharing = [{ id: 'g1', name: 'A', required: false, multiple: false, options: [{ id: 'g1', name: 'One', priceDelta: 0 }] }];
  assert.equal(parseServices([{ ...CUT_ROW, options: sharing }]).length, 0);
});

test('no more than the server allows is read: six questions of twelve options', () => {
  const groups = Array.from({ length: 8 }, (_, g) => ({
    id: `g${g}`,
    name: `G${g}`,
    required: false,
    multiple: true,
    options: Array.from({ length: 15 }, (_, o) => ({ id: `g${g}o${o}`, name: `O${o}`, priceDelta: 1 })),
  }));
  const [service] = parseServices([{ ...CUT_ROW, options: groups }]);
  assert.equal(service?.groups.length, 6);
  assert.ok(service?.groups.every((group) => group.options.length === 12));
});

test('the staff who can be named are read, and a nameless or repeated one is not', () => {
  assert.deepEqual(PERFORMERS, [{ id: 'p-1', name: 'Wanjiku' }, { id: 'p-2', name: 'Otieno' }]);
  assert.deepEqual(
    parsePerformers([{ staffProfileId: 'p-1', displayName: 'A' }, { staffProfileId: 'p-1', displayName: 'B' }, { staffProfileId: 'p-3', displayName: '  ' }, { staffProfileId: 'x y', displayName: 'C' }, null, 5]),
    [{ id: 'p-1', name: 'A' }]
  );
});

test('who may do a service: its own list, or everyone when it names no one', () => {
  assert.deepEqual(performersFor(CUT, PERFORMERS).map((p) => p.id), ['p-1']);
  assert.deepEqual(performersFor(BRAIDS, PERFORMERS).map((p) => p.id), ['p-1', 'p-2']);
  assert.deepEqual(performersFor({ ...CUT, performerIds: ['gone'] }, PERFORMERS), []);
});

test('services are found by what is typed in their name, in the shop order', () => {
  assert.deepEqual(searchServices(SERVICES, '').map((s) => s.id), ['s-braids', 's-cut', 's-col']);
  assert.deepEqual(searchServices(SERVICES, '  CO ').map((s) => s.id), ['s-col']);
  assert.deepEqual(searchServices(SERVICES, 'cut').map((s) => s.id), ['s-cut'], 'a word in the middle of a name is found');
  assert.deepEqual(searchServices(SERVICES, 'zzz'), []);
});

// ---- choosing

test('a choice starts with nobody, unless only one person can do the service', () => {
  assert.equal(startChoice(BRAIDS, PERFORMERS).performerId, null, 'two can: the cashier says who did it');
  // The haircut is only done by p-1, so p-1 is the only one who can.
  assert.equal(startChoice(CUT, PERFORMERS).performerId, 'p-1');
  assert.equal(startChoice(BRAIDS, [PERFORMERS[1] as Performer]).performerId, 'p-2');
  assert.equal(startChoice({ ...CUT, performerIds: ['gone'] }, PERFORMERS).performerId, null, 'no one can');
  assert.deepEqual(startChoice(BRAIDS, PERFORMERS), { performerId: null, optionIds: [], quantity: 1, typedCents: null });
});

test('people who share a name are found, whatever the case, so that the screen can say so', () => {
  const people = parsePerformers([
    { staffProfileId: 'a', displayName: 'Peter' },
    { staffProfileId: 'b', displayName: 'Mary' },
    { staffProfileId: 'c', displayName: ' peter ' },
    { staffProfileId: 'd', displayName: 'Peter' },
    { staffProfileId: 'e', displayName: 'Mary' },
    { staffProfileId: 'f', displayName: 'Ann' },
  ]);
  assert.deepEqual(sharedNames(people), ['Peter', 'Mary'], 'each name once, in the order it first appears');
  assert.deepEqual(sharedNames(PERFORMERS), []);
  assert.deepEqual(sharedNames([]), []);
  // Names that differ only in case, or in spaces round them, are the same name; the first one's spelling is told.
  assert.deepEqual(sharedNames(parsePerformers([{ staffProfileId: 'a', displayName: 'Ann' }, { staffProfileId: 'b', displayName: 'ANN' }])), ['Ann']);
  assert.deepEqual(sharedNames([{ id: 'a', name: 'Ann' }, { id: 'b', name: ' ann ' }]), ['Ann'], 'a name that was not cleaned on the way in');
});

test('tapping an option: one answer in a group of one, several in a group of many, always in the service order', () => {
  let choice = pick(BRAIDS);
  choice = toggleOption(BRAIDS, choice, 'long');
  assert.deepEqual(choice.optionIds, ['long']);
  choice = toggleOption(BRAIDS, choice, 'short');
  assert.deepEqual(choice.optionIds, ['short'], 'another answer replaces the first');
  choice = toggleOption(BRAIDS, choice, 'short');
  assert.deepEqual(choice.optionIds, ['short'], 'a required question stays answered');
  choice = toggleOption(BRAIDS, choice, 'wash');
  choice = toggleOption(BRAIDS, choice, 'packs');
  assert.deepEqual(choice.optionIds, ['short', 'packs', 'wash'], 'tapped in the other order, kept in the service order');
  choice = toggleOption(BRAIDS, choice, 'packs');
  assert.deepEqual(choice.optionIds, ['short', 'wash'], 'an extra can be switched off');
});

test('an optional question can be answered again to take the answer back', () => {
  const optional: Service = { ...CUT, groups: [{ id: 'g', name: 'Style', required: false, multiple: false, options: [{ id: 'a', name: 'A', extraCents: 0 }] }] };
  const on = toggleOption(optional, pick(optional), 'a');
  assert.deepEqual(on.optionIds, ['a']);
  assert.deepEqual(toggleOption(optional, on, 'a').optionIds, []);
});

test('a tap on something that is not an option of the service changes nothing', () => {
  const choice = pick(BRAIDS, { optionIds: ['long'] });
  assert.equal(toggleOption(BRAIDS, choice, 'nope'), choice);
});

test('no more than the server takes can be switched on', () => {
  const many: Service = {
    ...CUT,
    groups: [{ id: 'g', name: 'Extras', required: false, multiple: true, options: Array.from({ length: 12 }, (_, n) => ({ id: `o${n}`, name: `O${n}`, extraCents: 100 })) }],
  };
  let choice = pick(many);
  for (let n = 0; n < 12; n += 1) choice = toggleOption(many, choice, `o${n}`);
  assert.equal(choice.optionIds.length, MAX_CHOSEN_OPTIONS);
  assert.equal(MAX_CHOSEN_OPTIONS, 10);
});

// ---- the price: the server's rule, in cents

test('the price is the listed price and what was chosen, counted in cents', () => {
  assert.equal(listedCents(BRAIDS, []), 150000);
  assert.equal(listedCents(BRAIDS, ['long']), 200000);
  assert.equal(listedCents(BRAIDS, ['long', 'packs', 'wash']), 150000 + 50000 + 20050 + 10000);
  assert.equal(listedCents(BRAIDS, ['long', 'long']), 200000, 'the same option twice is counted once');
  assert.equal(listedCents(BRAIDS, ['nope']), null);
});

test('prices are added as whole cents, so a sum of shillings never drifts', () => {
  const [tenCents] = parseServices([{ ...CUT_ROW, price: 0.1, options: [{ id: 'g', name: 'G', required: false, multiple: false, options: [{ id: 'o', name: 'O', priceDelta: 0.2 }] }] }]);
  assert.ok(tenCents);
  const line = planned(tenCents, pick(tenCents, { optionIds: ['o'] }));
  assert.equal(line.unitPrice, 0.3);
  assert.notEqual(0.1 + 0.2, 0.3, 'the ordinary sum would have been 0.30000000000000004');
});

test('a fixed-price service is sold at its listed price whatever was typed', () => {
  assert.equal(priceFor(BRAIDS, pick(BRAIDS, { optionIds: ['long'], typedCents: 1 })), 200000);
  assert.equal(priceFor(CUT, pick(CUT, { typedCents: 99999 })), 30000);
  assert.equal(priceFor(BRAIDS, pick(BRAIDS, { optionIds: ['nope'] })), null);
});

test('a variable-price service is sold at the price typed, or its listed price while none is typed', () => {
  assert.equal(priceFor(COLOUR, pick(COLOUR)), null, 'listed at nothing, and nothing typed');
  assert.equal(priceFor(COLOUR, pick(COLOUR, { typedCents: 250000 })), 250000);
  const listedVariable: Service = { ...COLOUR, priceCents: 100000 };
  assert.equal(priceFor(listedVariable, pick(listedVariable)), 100000);
  assert.equal(priceFor(listedVariable, pick(listedVariable, { typedCents: 123456 })), 123456);
});

// Braids priced by the person at the till, from 1,000, with a length and extras that add to it.
const PLAITS: Service = { ...BRAIDS, variablePrice: true, priceCents: 100000 };

test('what is chosen on a variable-price service adds to the price agreed, as it does on the web and in the server tickets', () => {
  // Nothing typed: the listed price is the starting point, and Long adds 500.
  assert.equal(priceFor(PLAITS, pick(PLAITS, { optionIds: ['long'] })), 100000 + 50000);
  // Typed 1,200: that is the price before what is chosen, and Long still adds 500.
  assert.equal(priceFor(PLAITS, pick(PLAITS, { optionIds: ['long'], typedCents: 120000 })), 120000 + 50000);
  assert.equal(priceFor(PLAITS, pick(PLAITS, { optionIds: ['long', 'packs', 'wash'], typedCents: 120000 })), 120000 + 50000 + 20050 + 10000);
  // Typing the listed price comes to the same as typing nothing: it cannot take the extras away.
  assert.equal(priceFor(PLAITS, pick(PLAITS, { optionIds: ['long'], typedCents: 100000 })), priceFor(PLAITS, pick(PLAITS, { optionIds: ['long'] })));
  const line = planned(PLAITS, pick(PLAITS, { optionIds: ['long'], typedCents: 120000 }));
  assert.equal(line.unitPrice, 1700);
  assert.equal(line.itemId, 'svc:s-braids:p-1:long:170000');
});

test('a variable-price service with no price agreed is not sold for its extras alone', () => {
  const unpriced: Service = { ...PLAITS, priceCents: 0 };
  assert.equal(refused(unpriced, pick(unpriced, { optionIds: ['long'] })), 'Enter the price.');
  assert.equal(refused(unpriced, pick(unpriced, { optionIds: ['long'], typedCents: 0 })), 'The price must be above zero.');
  assert.equal(refused(unpriced, pick(unpriced, { optionIds: ['long'], typedCents: -5 })), 'The price must be above zero.');
  assert.equal(planned(unpriced, pick(unpriced, { optionIds: ['long'], typedCents: 100000 })).unitPrice, 1500);
  // The most a unit may come to includes what is chosen on it.
  assert.equal(refused(unpriced, pick(unpriced, { optionIds: ['long'], typedCents: MAX_TYPED_CENTS })), 'That price is too large.');
  assert.equal(planService(unpriced, PERFORMERS, pick(unpriced, { optionIds: ['short'], typedCents: MAX_TYPED_CENTS })).ok, true, 'a free choice adds nothing');
});

test('a price is split for the screen: before what was chosen, what that adds, and the sum', () => {
  assert.deepEqual(breakdownFor(BRAIDS, pick(BRAIDS, { optionIds: ['long', 'packs'] })), { baseCents: 150000, extrasCents: 70050, unitCents: 220050 });
  assert.deepEqual(breakdownFor(PLAITS, pick(PLAITS, { optionIds: ['long'], typedCents: 120000 })), { baseCents: 120000, extrasCents: 50000, unitCents: 170000 });
  assert.deepEqual(breakdownFor(CUT, pick(CUT)), { baseCents: 30000, extrasCents: 0, unitCents: 30000 });
  assert.equal(breakdownFor(COLOUR, pick(COLOUR)), null, 'no price yet');
  assert.equal(breakdownFor(BRAIDS, pick(BRAIDS, { optionIds: ['nope'] })), null, 'not an option of the service');
});

test('the price before the choices, and what the choices add, are each counted on their own', () => {
  assert.equal(baseCents(CUT, null), 30000);
  assert.equal(baseCents(CUT, 1), 30000, 'a fixed price is never the typed one');
  assert.equal(baseCents(COLOUR, null), null);
  assert.equal(baseCents(COLOUR, 5000), 5000);
  assert.equal(baseCents(PLAITS, null), 100000);
  assert.equal(baseCents(PLAITS, 7), 7);
  assert.equal(extrasCents(BRAIDS, []), 0);
  assert.equal(extrasCents(BRAIDS, ['long', 'packs']), 70050);
  assert.equal(extrasCents(BRAIDS, ['long', 'long']), 50000, 'the same option twice is counted once');
  assert.equal(extrasCents(BRAIDS, ['nope']), null);
});

test('extras that add up to more than a number can hold are not counted', () => {
  const huge: Service = {
    ...CUT,
    groups: [{ id: 'g', name: 'Extras', required: false, multiple: true, options: [{ id: 'a', name: 'A', extraCents: Number.MAX_SAFE_INTEGER }, { id: 'b', name: 'B', extraCents: Number.MAX_SAFE_INTEGER }] }],
  };
  assert.equal(extrasCents(huge, ['a']), Number.MAX_SAFE_INTEGER);
  assert.equal(extrasCents(huge, ['a', 'b']), null);
  assert.equal(listedCents(huge, ['a', 'b']), null);
});

test('a price that is not a whole number of cents is not a price', () => {
  for (const typedCents of [Number.NaN, 12.5, 0.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2]) {
    assert.equal(refused(COLOUR, pick(COLOUR, { typedCents })), 'Enter the price.', String(typedCents));
  }
});

// ---- the line

test('a plain service becomes one basket line with the price in shillings', () => {
  const line = planned(CUT, pick(CUT, { quantity: 2 }));
  assert.deepEqual(line, {
    itemId: 'svc:s-cut:p-1::30000',
    name: 'Haircut',
    quantity: 2,
    unitPrice: 300,
    service: { serviceId: 's-cut', performerId: 'p-1', performerName: 'Wanjiku', optionIds: [] },
  });
  assert.ok(line.itemId.startsWith(SERVICE_ID_PREFIX));
  assert.equal(cartCents([line]), 60000);
});

test('what was chosen is in the line: named as the receipt names it, and sent by id in the service order', () => {
  const line = planned(BRAIDS, pick(BRAIDS, { performerId: 'p-2', optionIds: ['packs', 'long'] }));
  assert.equal(line.name, 'Braids (Long, Extra packs)');
  assert.equal(line.unitPrice, 2200.5);
  assert.equal(line.itemId, 'svc:s-braids:p-2:long,packs:220050');
  assert.deepEqual(line.service, { serviceId: 's-braids', performerId: 'p-2', performerName: 'Otieno', optionIds: ['long', 'packs'] });
});

test('the same service, person, choices and price is one line; any difference is another', () => {
  const a = planned(BRAIDS, pick(BRAIDS, { optionIds: ['long'] }));
  assert.equal(a.itemId, planned(BRAIDS, pick(BRAIDS, { optionIds: ['long'] })).itemId);
  assert.notEqual(a.itemId, planned(BRAIDS, pick(BRAIDS, { optionIds: ['short'] })).itemId);
  assert.notEqual(a.itemId, planned(BRAIDS, pick(BRAIDS, { optionIds: ['long'], performerId: 'p-2' })).itemId);
  const typed = (cents: number) => planned(COLOUR, pick(COLOUR, { typedCents: cents })).itemId;
  assert.notEqual(typed(100000), typed(100100));
  assert.equal(typed(100000), typed(100000));
});

test('the till says no, in words, to what the server would turn down and to what it would quietly change', () => {
  assert.equal(refused(BRAIDS, pick(BRAIDS, { performerId: null, optionIds: ['long'] })), 'Choose who did it.');
  assert.equal(refused(CUT, pick(CUT, { performerId: 'p-2' })), 'That person does not do Haircut.');
  assert.equal(refused(CUT, pick(CUT, { performerId: 'gone' })), 'That person does not do Haircut.');
  assert.equal(refused(BRAIDS, pick(BRAIDS, { optionIds: [] })), 'Choose Length.');
  assert.equal(refused(BRAIDS, pick(BRAIDS, { optionIds: ['wash'] })), 'Choose Length.', 'an extra does not answer the length');
  assert.equal(refused(BRAIDS, pick(BRAIDS, { optionIds: ['short', 'long'] })), 'Choose only one for Length.');
  assert.equal(refused(BRAIDS, pick(BRAIDS, { optionIds: ['long', 'nope'] })), 'One of those choices is not offered on this service.');
  assert.equal(refused(BRAIDS, pick(BRAIDS, { optionIds: ['long', 'long'] })), 'Something is chosen twice.');
  for (const quantity of [0, -1, 1.5, MAX_SERVICE_QUANTITY + 1, Number.NaN]) {
    assert.equal(refused(CUT, pick(CUT, { quantity })), 'How many? From 1 to 99.', String(quantity));
  }
  assert.equal(refused(COLOUR, pick(COLOUR)), 'Enter the price.');
  assert.equal(refused(COLOUR, pick(COLOUR, { typedCents: 0 })), 'The price must be above zero.');
  assert.equal(refused(COLOUR, pick(COLOUR, { typedCents: -5 })), 'The price must be above zero.');
  assert.equal(refused(COLOUR, pick(COLOUR, { typedCents: MAX_TYPED_CENTS + 1 })), 'That price is too large.');
  assert.equal(planService(COLOUR, PERFORMERS, pick(COLOUR, { typedCents: MAX_TYPED_CENTS })).ok, true);
});

test('more than ten options are refused by the till: the sale route has no count of its own to refuse them with', () => {
  const many: Service = {
    ...CUT,
    groups: [{ id: 'g', name: 'Extras', required: false, multiple: true, options: Array.from({ length: 12 }, (_, n) => ({ id: `o${n}`, name: `O${n}`, extraCents: 100 })) }],
  };
  const eleven = Array.from({ length: 11 }, (_, n) => `o${n}`);
  assert.equal(refused(many, pick(many, { optionIds: eleven })), 'Choose at most 10 options.');
  assert.equal(planService(many, PERFORMERS, pick(many, { optionIds: eleven.slice(0, 10) })).ok, true);
});

test('a service with no price, or one that cannot be counted, is not added', () => {
  const free: Service = { ...CUT, priceCents: 0 };
  assert.equal(refused(free, pick(free)), 'The price must be above zero.');
  const huge: Service = { ...CUT, priceCents: Number.MAX_SAFE_INTEGER };
  assert.equal(refused(huge, pick(huge)), 'That price is too large.');
});

test('a sum too big for a number is not a price, whether the service is fixed or typed at the till', () => {
  const extra = { id: 'o', name: 'Extra', extraCents: 10 };
  const sums = (variablePrice: boolean): Service => ({
    ...CUT,
    variablePrice,
    priceCents: Number.MAX_SAFE_INTEGER,
    groups: [{ id: 'g', name: 'Extras', required: false, multiple: false, options: [extra] }],
  });
  // Fixed: the listed price and the extra cannot be added.
  const fixed = sums(false);
  assert.equal(listedCents(fixed, ['o']), null);
  assert.equal(priceFor(fixed, pick(fixed, { optionIds: ['o'] })), null);
  assert.equal(refused(fixed, pick(fixed, { optionIds: ['o'] })), 'That price is too large.');
  // Variable: the price typed and the extra cannot be added, and neither can the listed price the till falls back on.
  const variable = sums(true);
  assert.equal(priceFor(variable, pick(variable, { optionIds: ['o'], typedCents: Number.MAX_SAFE_INTEGER })), null);
  assert.equal(refused(variable, pick(variable, { optionIds: ['o'], typedCents: Number.MAX_SAFE_INTEGER })), 'That price is too large.');
  assert.equal(refused(variable, pick(variable, { optionIds: ['o'] })), 'That price is too large.');
  // A typed price that is small enough is a price, whatever the shop listed.
  assert.equal(priceFor(variable, pick(variable, { optionIds: ['o'], typedCents: 5000 })), 5010);
});

test('a variable-price service with nothing typed and no listed price asks for the price', () => {
  assert.equal(COLOUR.priceCents, 0);
  assert.equal(refused(COLOUR, pick(COLOUR)), 'Enter the price.');
});

test('the price sent is the price the server will compute: listed plus chosen, to the cent', () => {
  // The server compares BigDecimal(unitPrice) with price + the sum of the chosen extras.
  for (const [ids, expected] of [
    [['short'], '1500.00'],
    [['long'], '2000.00'],
    [['long', 'packs'], '2200.50'],
    [['long', 'packs', 'wash'], '2300.50'],
  ] as const) {
    const line = planned(BRAIDS, pick(BRAIDS, { optionIds: [...ids] }));
    assert.equal(line.unitPrice.toFixed(2), expected);
    assert.equal(fromCents(Math.round(line.unitPrice * 100)), line.unitPrice);
  }
});

// ---- the basket

test('the same service added again is one line with more of it; another is a new line', () => {
  const braids = planned(BRAIDS, pick(BRAIDS, { optionIds: ['long'] }));
  let cart = addService([], braids) ?? [];
  cart = addService(cart, { ...braids, quantity: 2 }) ?? [];
  assert.equal(cart.length, 1);
  assert.equal(cart[0]?.quantity, 3);
  cart = addService(cart, planned(CUT, pick(CUT))) ?? [];
  assert.equal(cart.length, 2);
  assert.deepEqual(cart[0]?.service, braids.service, 'the tag survives the count going up');
});

test('the same service by another person, with other choices or at another price, is a line of its own', () => {
  const braids = planned(BRAIDS, pick(BRAIDS, { optionIds: ['long'] }));
  const other = [
    planned(BRAIDS, pick(BRAIDS, { optionIds: ['long'], performerId: 'p-2' })),
    planned(BRAIDS, pick(BRAIDS, { optionIds: ['short'] })),
    planned(BRAIDS, pick(BRAIDS, { optionIds: ['long', 'wash'] })),
  ];
  for (const line of other) {
    const cart = addService([braids], line) ?? [];
    assert.equal(cart.length, 2, line.itemId);
    assert.deepEqual(cart.map((l) => l.quantity), [1, 1]);
  }
  const a = planned(COLOUR, pick(COLOUR, { typedCents: 100000 }));
  const b = planned(COLOUR, pick(COLOUR, { typedCents: 150000 }));
  assert.equal((addService([a], b) ?? []).length, 2);
});

test('adding to a line changes that line only', () => {
  const braids = planned(BRAIDS, pick(BRAIDS, { optionIds: ['long'] }));
  const cut = planned(CUT, pick(CUT, { quantity: 4 }));
  const cart = addService(addService([cut], braids) ?? [], { ...braids, quantity: 2 }) ?? [];
  assert.deepEqual(cart.map((l) => [l.itemId === braids.itemId, l.quantity]), [[false, 4], [true, 3]]);
});

test('a line that is not a whole count of an amount above zero is not put in the basket', () => {
  const line = planned(CUT, pick(CUT));
  assert.ok(addService([], line), 'the line as planned goes in');
  for (const quantity of [0, -1, 1.5, Number.NaN, MAX_UNITS + 1]) {
    assert.equal(addService([], { ...line, quantity }), null, `quantity ${quantity}`);
  }
  for (const unitPrice of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.001]) {
    assert.equal(addService([], { ...line, unitPrice }), null, `price ${unitPrice}`);
  }
  assert.equal(addService([], { ...line, itemId: 'i-1' }), null, 'a service line has a service id');
  assert.equal(addService([], { ...line, quantity: MAX_UNITS })?.[0]?.quantity, MAX_UNITS, 'the most a line may hold goes in');
});

test('a line that is not a service, or too many of one, is not added', () => {
  assert.equal(addService([], { itemId: 'i-1', name: 'Milk', quantity: 1, unitPrice: 65 }), null);
  const line = planned(CUT, pick(CUT, { quantity: 50 }));
  const nearly = addService([], { ...line, quantity: MAX_UNITS - 10 }) ?? [];
  assert.equal(addService(nearly, line), null);
  assert.equal(nearly.length, 1);
});

test('services and products share one basket and one total', () => {
  const milk: CartItem = { id: 'i-milk', name: 'Milk', sellingPrice: 65 };
  let cart = addUnit([], milk) ?? [];
  cart = addService(cart, planned(CUT, pick(CUT))) ?? [];
  cart = addService(cart, planned(BRAIDS, pick(BRAIDS, { optionIds: ['long', 'packs'] }))) ?? [];
  assert.equal(cart.length, 3);
  assert.equal(cartCents(cart), 6500 + 30000 + 220050);
});

test('the basket buttons that work on any line keep a service line whole', () => {
  const braids = planned(BRAIDS, pick(BRAIDS, { optionIds: ['long'] }));
  const milk: CartItem = { id: 'i-milk', name: 'Milk', sellingPrice: 65 };
  const cart = addService(addUnit([], milk) ?? [], braids) ?? [];
  const more = setUnits(cart, braids.itemId, 3) ?? [];
  assert.equal(more[1]?.quantity, 3);
  assert.deepEqual(more[1]?.service, braids.service);
  assert.deepEqual(removeLine(more, 'i-milk')[0]?.service, braids.service);
  assert.deepEqual(removeLine(more, braids.itemId).map((line) => line.itemId), ['i-milk']);
  assert.equal(setUnits(cart, braids.itemId, 0)?.length, 1, 'zero takes the line out');
  assert.deepEqual(backToShelf(more), more, 'there is no shelf price to go back to');
});

test('the price of a service line cannot be changed from the basket', () => {
  const line = planned(CUT, pick(CUT));
  assert.equal(setLinePrice([line], line.itemId, 100), null);
  assert.equal(setLinePrice([line], line.itemId, 30000), null, 'not even to the same price');
});

test('a service line reads on the screen like any other, and says who did it', () => {
  const line = planned(CUT, pick(CUT, { quantity: 2 }));
  assert.deepEqual(lineWords(line), { quantity: '2', price: '300.00', total: '600.00' });
  assert.equal(describeServiceLine(line), 'Done by Wanjiku');
  assert.equal(describeServiceLine({ itemId: 'i-1', name: 'Milk', quantity: 1, unitPrice: 65 }), null);
});

test('the list says what a service costs and how long it takes', () => {
  assert.equal(priceWords(CUT), 'KES 300.00');
  assert.equal(priceWords(COLOUR), 'price set at the till');
  assert.equal(priceWords({ ...COLOUR, priceCents: 150000 }), 'from KES 1,500.00');
  assert.equal(durationWords(0), '');
  assert.equal(durationWords(Number.NaN), '');
  assert.equal(durationWords(45), '45 min');
  assert.equal(durationWords(60), '1 h');
  assert.equal(durationWords(90), '1 h 30 min');
});

test('the most that one go may add is allowed, and one more is not', () => {
  assert.equal(planService(CUT, PERFORMERS, pick(CUT, { quantity: MAX_SERVICE_QUANTITY })).ok, true);
  assert.equal(planService(CUT, PERFORMERS, pick(CUT, { quantity: 1 })).ok, true);
  assert.equal(planService(CUT, PERFORMERS, pick(CUT, { quantity: MAX_SERVICE_QUANTITY + 1 })).ok, false);
});

test('a line may hold exactly the most a line can, and no more', () => {
  const line = planned(CUT, pick(CUT, { quantity: 50 }));
  const nearly = addService([], { ...line, quantity: MAX_UNITS - 50 }) ?? [];
  assert.equal(addService(nearly, line)?.[0]?.quantity, MAX_UNITS);
});

test('putting a service line back on a shelf price would keep what it is, though it is never asked to', () => {
  const line = planned(CUT, pick(CUT));
  assert.deepEqual(onShelfPrice({ ...line, shelfPrice: 1 }, 300), line);
});
