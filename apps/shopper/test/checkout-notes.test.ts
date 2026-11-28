import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderNotes,
  cleanNoteValue,
  MAX_ORDER_NOTES,
  notesFit,
  parseOrderNotes,
  type OrderNoteFields,
} from '../src/lib/checkout-notes';

/**
 * The website's line, copied from `frontend/components/storefront/shop-checkout-form.tsx` (the `notes:` array in
 * `onSubmit`), so a difference between the two shows up here and not at the shop.
 */
function websiteNotes(f: {
  payOnDelivery: boolean;
  streetAddress: string;
  county: string;
  subCounty: string;
  ward: string;
  whatsAppNumber: string;
  isDefaultAddress: boolean;
  deliveryNotes: string;
}): string {
  return [
    f.payOnDelivery ? 'Payment: Pay on delivery' : '',
    f.streetAddress.trim() ? `Street: ${f.streetAddress.trim()}` : '',
    f.county.trim() ? `County: ${f.county.trim()}` : '',
    f.subCounty.trim() ? `Subcounty: ${f.subCounty.trim()}` : '',
    f.ward.trim() ? `Ward: ${f.ward.trim()}` : '',
    f.whatsAppNumber.trim() ? `WhatsApp: ${f.whatsAppNumber.trim()}` : '',
    f.isDefaultAddress ? 'Set as default address' : '',
    f.deliveryNotes.trim() ? `Notes: ${f.deliveryNotes.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

const FULL = {
  payOnDelivery: true,
  streetAddress: ' Sunrise Apartments, Block B ',
  county: 'Nairobi',
  subCounty: 'Kilimani',
  ward: 'Kilimani',
  whatsAppNumber: '0722 111 222',
  isDefaultAddress: true,
  deliveryNotes: ' Gate code 4411 ',
};

function asFields(w: typeof FULL): OrderNoteFields {
  return {
    payLater: w.payOnDelivery,
    street: w.streetAddress,
    county: w.county,
    subCounty: w.subCounty,
    ward: w.ward,
    whatsApp: w.whatsAppNumber,
    setAsDefault: w.isDefaultAddress,
    deliveryNotes: w.deliveryNotes,
  };
}

test('an order from the app carries the same line as one from the website', () => {
  assert.equal(
    buildOrderNotes(asFields(FULL)),
    'Payment: Pay on delivery | Street: Sunrise Apartments, Block B | County: Nairobi | Subcounty: Kilimani | Ward: Kilimani | WhatsApp: 0722 111 222 | Set as default address | Notes: Gate code 4411',
  );
});

test('every mix of what is filled in and what is left out gives the website\'s line, and nothing else does', () => {
  const blanks = ['', '   '];
  let checked = 0;
  for (let mask = 0; mask < 256; mask += 1) {
    const w = { ...FULL };
    if (mask & 1) w.payOnDelivery = false;
    if (mask & 2) w.streetAddress = blanks[mask % 2];
    if (mask & 4) w.county = '';
    if (mask & 8) w.subCounty = blanks[(mask >> 3) % 2];
    if (mask & 16) w.ward = '';
    if (mask & 32) w.whatsAppNumber = '';
    if (mask & 64) w.isDefaultAddress = false;
    if (mask & 128) w.deliveryNotes = '  ';
    assert.equal(buildOrderNotes(asFields(w)), websiteNotes(w), `mask ${mask}`);
    checked += 1;
  }
  assert.equal(checked, 256);
});

test('nothing filled in is an empty line, which the order leaves out', () => {
  assert.equal(buildOrderNotes({}), '');
  assert.equal(buildOrderNotes({ street: '  ', deliveryNotes: '\n' }), '');
});

test('a line read back gives what was written, for a delivery and for a pickup', () => {
  const read = parseOrderNotes(buildOrderNotes(asFields(FULL)));
  assert.deepEqual(read, {
    payLater: true,
    pickup: false,
    street: 'Sunrise Apartments, Block B',
    county: 'Nairobi',
    subCounty: 'Kilimani',
    ward: 'Kilimani',
    whatsApp: '0722 111 222',
    deliveryNotes: 'Gate code 4411',
    isDefault: true,
  });
  const pickup = parseOrderNotes(buildOrderNotes({ pickup: true, payLater: true, deliveryNotes: 'After 5pm' }));
  assert.deepEqual(pickup, { payLater: true, pickup: true, deliveryNotes: 'After 5pm', isDefault: false });
});

test('a pickup says so, and pays at pickup, in segments the website\'s reader passes over', () => {
  assert.equal(buildOrderNotes({ pickup: true }), 'Pickup at the counter');
  assert.equal(buildOrderNotes({ pickup: true, payLater: true }), 'Pickup at the counter | Payment: Pay at pickup');
  assert.equal(buildOrderNotes({ payLater: true }), 'Payment: Pay on delivery');
  // What the server's `ShopperOrderNotesParser` takes from a line: the same labels, and nothing it does not know.
  const serverLabels = ['Street:', 'County:', 'Subcounty:', 'Ward:', 'WhatsApp:', 'Notes:'];
  for (const segment of ['Pickup at the counter', 'Payment: Pay at pickup', 'Payment: Pay on delivery']) {
    assert.ok(!serverLabels.some((label) => segment.startsWith(label)), segment);
  }
});

test('a bar typed inside a value does not end the value, and a line break is one line', () => {
  assert.equal(cleanNoteValue('Gate B | code 4411'), 'Gate B / code 4411');
  assert.equal(cleanNoteValue('first\r\n second\nthird'), 'first second third');
  const line = buildOrderNotes({ street: 'Shop 4 | Mall', deliveryNotes: 'Call me\nafter 5 | not before' });
  assert.equal(line, 'Street: Shop 4 / Mall | Notes: Call me after 5 / not before');
  assert.equal(parseOrderNotes(line).deliveryNotes, 'Call me after 5 / not before');
  assert.equal(parseOrderNotes(line).street, 'Shop 4 / Mall');
});

test('a line that says nothing, or something the shop wrote by hand, reads as nothing', () => {
  const none = { payLater: false, pickup: false, isDefault: false };
  assert.deepEqual(parseOrderNotes(''), none);
  assert.deepEqual(parseOrderNotes(null), none);
  assert.deepEqual(parseOrderNotes(undefined), none);
  assert.deepEqual(parseOrderNotes(' | | '), none);
  assert.deepEqual(parseOrderNotes('Call before delivery'), none);
  assert.deepEqual(parseOrderNotes('street: lower case is not a label'), none);
});

test('a label with nothing after it is read as empty, and a later one with the same label wins, as on the website', () => {
  assert.equal(parseOrderNotes('Street:').street, '');
  assert.equal(parseOrderNotes('Street: A | Street: B').street, 'B');
});

test('the line is within what the server takes until it is longer than 2000 characters', () => {
  assert.equal(MAX_ORDER_NOTES, 2000);
  assert.equal(notesFit('x'.repeat(2000)), true);
  assert.equal(notesFit('x'.repeat(2001)), false);
  assert.equal(notesFit(''), true);
});

test('a segment nobody knows is passed over, and the ones after it are still read', () => {
  const parsed = parseOrderNotes('Street: Moi Ave | Something else: 5 | Ward: Kilimani | Notes: Gate 4411');
  assert.equal(parsed.street, 'Moi Ave');
  assert.equal(parsed.ward, 'Kilimani');
  assert.equal(parsed.deliveryNotes, 'Gate 4411');
});
