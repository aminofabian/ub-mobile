import { test } from 'node:test';
import assert from 'node:assert/strict';
import { counterServices, coverageLimits, shopWebUrl } from '../src/lib/coverage';

test('a shop the server says nothing about is shown exactly as it always was', () => {
  assert.deepEqual(coverageLimits(null), []);
  assert.deepEqual(coverageLimits(undefined), []);
  assert.deepEqual(coverageLimits({}), []);
  assert.deepEqual(coverageLimits({ storeTypes: ['restaurant'] }), [], 'a format on its own says nothing about what the app lacks');
  assert.deepEqual(coverageLimits({ capabilities: { airtime: true, powerTokens: true, shiftsDisabled: true, weighed: true } }), []);
});

test('only an explicit yes produces a line, and a no produces nothing', () => {
  assert.deepEqual(coverageLimits({ capabilities: { tableOrdering: false, bookings: false, rooms: false, dispensing: false } }), []);
  assert.deepEqual(coverageLimits({ capabilities: { tableOrdering: true } }), ['Table orders are not taken in this app.']);
  assert.deepEqual(coverageLimits({ capabilities: { bookings: true } }), ['Appointments and bookings are not made in this app.']);
  assert.deepEqual(coverageLimits({ capabilities: { rooms: true } }), ['Rooms are not booked in this app.']);
  assert.deepEqual(coverageLimits({ capabilities: { dispensing: true } }), ['Prescription medicines are not sold in this app.']);
  assert.deepEqual(coverageLimits({ storeTypes: ['clinic'] }), ['Clinic visits are not arranged in this app.']);
});

test('a shop that does several things is told in a fixed order, whatever order the server sent', () => {
  const lines = coverageLimits({
    storeTypes: ['bar', 'clinic'],
    capabilities: { dispensing: true, rooms: true, tableOrdering: true, bookings: true },
  });
  assert.deepEqual(lines, [
    'Table orders are not taken in this app.',
    'Appointments and bookings are not made in this app.',
    'Rooms are not booked in this app.',
    'Prescription medicines are not sold in this app.',
    'Clinic visits are not arranged in this app.',
  ]);
});

test('power tokens and airtime stay on unless the server says they are off', () => {
  assert.deepEqual(counterServices(undefined), { airtime: true, powerTokens: true });
  assert.deepEqual(counterServices({}), { airtime: true, powerTokens: true });
  assert.deepEqual(counterServices({ powerTokens: true, airtime: true }), { airtime: true, powerTokens: true });
  assert.deepEqual(counterServices({ powerTokens: false }), { airtime: true, powerTokens: false });
  assert.deepEqual(counterServices({ airtime: false }), { airtime: false, powerTokens: true });
  assert.deepEqual(counterServices({ airtime: false, powerTokens: false }), { airtime: false, powerTokens: false });
  assert.deepEqual(counterServices({ tableOrdering: true }), { airtime: true, powerTokens: true });
});

test('a shop address becomes a web link only when it is a plain address', () => {
  assert.equal(shopWebUrl('acme.kiosk.ke'), 'https://acme.kiosk.ke');
  assert.equal(shopWebUrl(' Shop.Acme.CO.ke '), 'https://shop.acme.co.ke');
  assert.equal(shopWebUrl('localhost:3000'), 'https://localhost:3000');
  for (const bad of [undefined, '', 'a b', 'acme.kiosk.ke/evil', 'javascript:alert(1)', 'https://acme.kiosk.ke', '.kiosk.ke', 'acme@kiosk.ke']) {
    assert.equal(shopWebUrl(bad), null, String(bad));
  }
});
