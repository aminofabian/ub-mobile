import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyBook,
  forgetAddress,
  makeDefault,
  MAX_ADDRESSES,
  parseAddressBook,
  pickPrefill,
  rememberAddress,
  rememberContact,
  serializeAddressBook,
  usableFirst,
  type AddressBook,
} from '../src/lib/saved-addresses';

let counter = 0;
const newId = () => `a${(counter += 1)}`;
const at = (minutes: number) => new Date(Date.UTC(2026, 10, 23, 8, minutes));

function home(extra: Partial<Parameters<typeof rememberAddress>[1]> = {}) {
  return { area: 'Kilimani', street: 'Sunrise Apartments, Block B', county: 'Nairobi', deliveryNotes: 'Gate 4411', whatsApp: '', makeDefault: false, ...extra };
}

test('the first address kept is the default, whatever was asked', () => {
  const book = rememberAddress(emptyBook(), home(), at(0), newId);
  assert.equal(book.addresses.length, 1);
  assert.equal(book.addresses[0].isDefault, true);
  assert.equal(book.addresses[0].lastUsedAt, at(0).toISOString());
});

test('the same place again is the same address, with what was typed last', () => {
  let book = rememberAddress(emptyBook(), home(), at(0), newId);
  const id = book.addresses[0].id;
  book = rememberAddress(book, home({ area: 'kilimani', street: '  sunrise   apartments, block b', deliveryNotes: 'Call first' }), at(5), newId);
  assert.equal(book.addresses.length, 1);
  assert.equal(book.addresses[0].id, id);
  assert.equal(book.addresses[0].deliveryNotes, 'Call first');
  assert.equal(book.addresses[0].lastUsedAt, at(5).toISOString());
  assert.equal(book.addresses[0].isDefault, true, 'still the default');
});

test('asking for a new default moves it, and there is only ever one', () => {
  let book = rememberAddress(emptyBook(), home(), at(0), newId);
  book = rememberAddress(book, home({ area: 'Lavington', street: 'Office, 2nd floor', makeDefault: true }), at(1), newId);
  assert.deepEqual(book.addresses.map((a) => [a.area, a.isDefault]), [['Lavington', true], ['Kilimani', false]]);
  book = rememberAddress(book, home({ area: 'Karen', street: 'Gate 9' }), at(2), newId);
  assert.equal(book.addresses.filter((a) => a.isDefault).length, 1);
  assert.equal(book.addresses.find((a) => a.isDefault)?.area, 'Lavington', 'a new address does not take the default');
});

test('nothing is kept without an area and a place', () => {
  assert.equal(rememberAddress(emptyBook(), home({ area: '  ' }), at(0), newId).addresses.length, 0);
  assert.equal(rememberAddress(emptyBook(), home({ street: '' }), at(0), newId).addresses.length, 0);
});

test('only five are kept: the one used longest ago goes, and never the default', () => {
  let book: AddressBook = emptyBook();
  for (let i = 0; i < MAX_ADDRESSES; i += 1) {
    book = rememberAddress(book, home({ street: `Place ${i}` }), at(i), newId);
  }
  assert.equal(book.addresses.length, MAX_ADDRESSES);
  assert.equal(book.addresses.find((a) => a.isDefault)?.street, 'Place 0', 'the oldest is the default');
  book = rememberAddress(book, home({ street: 'Place new' }), at(10), newId);
  assert.equal(book.addresses.length, MAX_ADDRESSES);
  const streets = book.addresses.map((a) => a.street);
  assert.ok(streets.includes('Place 0'), 'the default stays however old');
  assert.ok(streets.includes('Place new'));
  assert.ok(!streets.includes('Place 1'), 'the oldest that is not the default goes');
});

test('forgetting the default hands it to the one used last', () => {
  let book = rememberAddress(emptyBook(), home({ street: 'A' }), at(0), newId);
  book = rememberAddress(book, home({ street: 'B' }), at(1), newId);
  book = rememberAddress(book, home({ street: 'C' }), at(2), newId);
  const defaultId = book.addresses.find((a) => a.isDefault)!.id;
  book = forgetAddress(book, defaultId);
  assert.equal(book.addresses.length, 2);
  assert.equal(book.addresses.find((a) => a.isDefault)?.street, 'C');
  assert.equal(forgetAddress(book, 'no-such-id'), book);
});

test('a chosen default is the only default', () => {
  let book = rememberAddress(emptyBook(), home({ street: 'A' }), at(0), newId);
  book = rememberAddress(book, home({ street: 'B' }), at(1), newId);
  const b = book.addresses.find((a) => a.street === 'B')!.id;
  book = makeDefault(book, b);
  assert.deepEqual(book.addresses.map((a) => [a.street, a.isDefault]).sort(), [['A', false], ['B', true]]);
  assert.equal(makeDefault(book, 'nope'), book);
});

test('a form starts on the default address the shop still serves', () => {
  let book = rememberAddress(emptyBook(), home({ area: 'Karen', street: 'Gate 9' }), at(0), newId);
  book = rememberAddress(book, home({ area: 'Kilimani', street: 'Block B' }), at(1), newId);
  assert.equal(pickPrefill(book, ['Karen', 'Kilimani'])?.street, 'Gate 9', 'the default');
  assert.equal(pickPrefill(book, ['Kilimani'])?.street, 'Block B', 'the default is no longer served, so the next one');
  assert.equal(pickPrefill(book, ['Westlands']), null);
  assert.equal(pickPrefill(book, null)?.street, 'Gate 9', 'with the areas unknown the default is offered as it is');
  assert.equal(pickPrefill(emptyBook(), ['Karen']), null);
});

test('the list offers what can be used first', () => {
  let book = rememberAddress(emptyBook(), home({ area: 'Karen', street: 'Gate 9' }), at(0), newId);
  book = rememberAddress(book, home({ area: 'Kilimani', street: 'Block B' }), at(1), newId);
  assert.deepEqual(usableFirst(book, ['Kilimani']).map((a) => a.area), ['Kilimani', 'Karen']);
  assert.deepEqual(usableFirst(book, null).map((a) => a.area), ['Karen', 'Kilimani']);
});

test('who the order was for is kept, trimmed, and an empty one is not', () => {
  const book = rememberContact(emptyBook(), { name: ' Amina Wanjiru ', phone: '0712 345 678', email: 'a@b.co', whatsApp: '' });
  assert.deepEqual(book.contact, { name: 'Amina Wanjiru', phone: '0712 345 678', email: 'a@b.co', whatsApp: '' });
  assert.equal(rememberContact(book, { name: '', phone: '', email: 'x@y.zz', whatsApp: '' }), book);
});

test('what is read back is what was kept, and damaged data is no book', () => {
  let book = rememberAddress(emptyBook(), home(), at(0), newId);
  book = rememberContact(book, { name: 'Amina', phone: '0712345678', email: '', whatsApp: '' });
  assert.deepEqual(parseAddressBook(serializeAddressBook(book)), book);
  assert.deepEqual(parseAddressBook(null), emptyBook());
  assert.deepEqual(parseAddressBook('not json'), emptyBook());
  assert.deepEqual(parseAddressBook('[1,2]'), emptyBook());
  assert.deepEqual(parseAddressBook('{"addresses":"x","contact":5}'), emptyBook());
});

test('an entry that is missing its area or place, or repeats another, is left out, and two defaults become one', () => {
  const raw = JSON.stringify({
    addresses: [
      { id: '1', area: 'Kilimani', street: 'A', isDefault: true, lastUsedAt: '2026-11-23T08:00:00.000Z' },
      { id: '2', area: '', street: 'B', lastUsedAt: '2026-11-23T08:01:00.000Z' },
      { id: '3', area: 'Karen', street: ' ', lastUsedAt: '2026-11-23T08:02:00.000Z' },
      { id: '1', area: 'Karen', street: 'Gate', lastUsedAt: '2026-11-23T08:03:00.000Z' },
      { id: '4', area: 'kilimani', street: 'a', lastUsedAt: '2026-11-23T08:04:00.000Z' },
      { id: '5', area: 'Lavington', street: 'Office', isDefault: true, lastUsedAt: '2026-11-23T08:05:00.000Z' },
      { area: 'Karen', street: 'No id' },
    ],
  });
  const book = parseAddressBook(raw);
  assert.deepEqual(book.addresses.map((a) => a.id).sort(), ['1', '5']);
  assert.equal(book.addresses.filter((a) => a.isDefault).length, 1);
});

test('a stored contact with no name, phone or email is no contact', () => {
  const book = parseAddressBook(JSON.stringify({ addresses: [], contact: { name: '', phone: '', email: '', whatsApp: '0722' } }));
  assert.equal(book.contact, null);
});

test('stored text is cut to the length the server takes', () => {
  const raw = JSON.stringify({
    addresses: [{ id: 'x', area: 'K'.repeat(300), street: 'S'.repeat(900), deliveryNotes: 'N'.repeat(2000), isDefault: true, lastUsedAt: '' }],
    contact: null,
  });
  const [address] = parseAddressBook(raw).addresses;
  assert.equal(address.area.length, 120);
  assert.equal(address.street.length, 500);
  assert.equal(address.deliveryNotes.length, 1000);
});
