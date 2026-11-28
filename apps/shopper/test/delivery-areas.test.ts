import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeAreaNames, describePlace, fulfilmentChoices, matchArea } from '../src/lib/delivery-areas';

const AREAS = [
  { id: '1', name: 'Kilimani', active: true },
  { id: '2', name: ' Lavington ', active: true },
  { id: '3', name: 'Karen', active: false },
  { id: '4', name: '   ', active: true },
  { id: '5', name: 'kilimani', active: true },
  { id: '6', active: true },
  { id: '7', name: null, active: true },
  { id: '8', name: 'Westlands' },
];

test('the areas are the active ones with a name, as the shop wrote them, each once', () => {
  assert.deepEqual(activeAreaNames(AREAS), ['Kilimani', 'Lavington']);
  assert.deepEqual(activeAreaNames([]), []);
  assert.deepEqual(activeAreaNames(undefined), []);
  assert.deepEqual(activeAreaNames(null), []);
});

test('an area is matched ignoring case and spaces, and comes back as the shop spells it', () => {
  const names = activeAreaNames(AREAS);
  assert.equal(matchArea(names, 'kilimani'), 'Kilimani');
  assert.equal(matchArea(names, '  LAVINGTON '), 'Lavington');
  assert.equal(matchArea(names, 'Karen'), null, 'an area the shop has switched off');
  assert.equal(matchArea(names, 'Kilimani estate'), null, 'a part of a name is not the name');
  assert.equal(matchArea(names, ''), null);
  assert.equal(matchArea(names, undefined), null);
  assert.equal(matchArea([], 'Kilimani'), null);
});

test('a shop with delivery areas offers a delivery first, and a pickup besides', () => {
  assert.deepEqual(fulfilmentChoices(AREAS), { canDeliver: true, initial: 'delivery' });
});

test('a shop with no active area takes pickups only, and says why', () => {
  assert.deepEqual(fulfilmentChoices([]), { canDeliver: false, whyNot: 'no-areas', initial: 'pickup' });
  assert.deepEqual(fulfilmentChoices([{ name: 'Karen', active: false }]), {
    canDeliver: false,
    whyNot: 'no-areas',
    initial: 'pickup',
  });
});

test('a shop whose list has not loaded is not assumed to deliver anywhere', () => {
  assert.deepEqual(fulfilmentChoices(undefined), { canDeliver: false, whyNot: 'unknown', initial: 'pickup' });
  assert.deepEqual(fulfilmentChoices(null), { canDeliver: false, whyNot: 'unknown', initial: 'pickup' });
});

test('a place is shown once whatever the ward, sub-county and county repeat', () => {
  assert.equal(describePlace({ ward: 'Kilimani', subCounty: 'Kilimani', county: 'Nairobi' }), 'Kilimani · Nairobi');
  assert.equal(describePlace({ ward: 'kilimani', subCounty: 'Kilimani' }), 'kilimani');
  assert.equal(describePlace({ ward: ' ', county: 'Nairobi' }), 'Nairobi');
  assert.equal(describePlace({}), '');
});
