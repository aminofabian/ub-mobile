import assert from 'node:assert/strict';
import test from 'node:test';
import { readStaff, STAFF_LIST_SIZE, type StaffPerson } from '../src/lib/staff';

/** One user as the server's `UserResponse` has it (identity/api/dto/UserResponse.java), with what a test changes laid over it. */
function user(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'u-1',
    businessId: 'b-1',
    branchId: null,
    email: 'wanjiku@tumaini.example',
    name: 'Wanjiku Kamau',
    phone: '0712345678',
    status: 'active',
    role: { id: 'r-1', key: 'cashier', name: 'Cashier', system: true },
    permissions: ['sales.sell'],
    itemTypeIds: [],
    hasPin: true,
    lastLoginAt: null,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
    ...over,
  };
}

/** A Spring page of users, as `GET /api/v1/users` answers. */
function page(...rows: unknown[]): Record<string, unknown> {
  return { content: rows, totalElements: rows.length, totalPages: 1, size: STAFF_LIST_SIZE, number: 0, first: true, last: true, empty: rows.length === 0 };
}

/** What `readStaff` read, for a test whose answer is a list (an answer that is not one is checked on its own). */
function staffOf(raw: unknown): StaffPerson[] {
  const people = readStaff(raw);
  assert.ok(people, 'the answer was read as a list');
  return people;
}

test('the people are in `content` of the page the server sends, and the role is read by its name', () => {
  assert.deepEqual(readStaff(page(user())), [{ id: 'u-1', name: 'Wanjiku Kamau', email: 'wanjiku@tumaini.example', roleName: 'Cashier' }]);
});

test('a bare list is read too', () => {
  assert.deepEqual(readStaff([user()]), [{ id: 'u-1', name: 'Wanjiku Kamau', email: 'wanjiku@tumaini.example', roleName: 'Cashier' }]);
});

test('an empty page is no one, and an answer that is not a page or a list is a failed read', () => {
  assert.deepEqual(readStaff(page()), []);
  assert.deepEqual(readStaff([]), []);
  for (const raw of [null, undefined, 'down', 42, true, {}, { users: [user()] }, { content: 'x' }, { content: null }, { content: { id: 'u-1' } }]) {
    assert.equal(readStaff(raw), null, JSON.stringify(raw));
  }
});

test('storefront shoppers are not people who work here, whatever case their role is written in', () => {
  const shopper = user({ id: 'u-2', name: 'A Shopper', role: { id: 'r-9', key: 'buyer', name: 'Buyer', system: true } });
  const loud = user({ id: 'u-3', name: 'Another Shopper', role: { id: 'r-9', key: ' BUYER ', name: 'Buyer', system: true } });
  assert.deepEqual(
    staffOf(page(shopper, user(), loud)).map((p) => p.id),
    ['u-1']
  );
});

test('a person with no role the server could name stays, with no role', () => {
  const none = user({ id: 'u-2', name: 'No Role', role: null });
  const odd = user({ id: 'u-3', name: 'Odd Role', role: 'cashier' });
  const unnamed = user({ id: 'u-4', name: 'Unnamed Role', role: { id: 'r-1', key: 'cashier', name: '  ', system: false } });
  assert.deepEqual(
    staffOf(page(none, odd, unnamed)).map((p) => [p.id, p.roleName]),
    [
      ['u-2', null],
      ['u-3', null],
      ['u-4', null],
    ]
  );
});

test('rows that are not people are skipped, and the rest are still read', () => {
  const rows = [null, 'x', 7, [], {}, { name: 'No Id' }, { id: '', name: 'Empty Id' }, { id: 12, name: 'Number Id' }, user()];
  assert.deepEqual(
    staffOf(page(...rows)).map((p) => p.id),
    ['u-1']
  );
});

test('a blank name or email is nothing, and what there is is trimmed', () => {
  const [blank] = readStaff(page(user({ name: '   ', email: '', role: { key: 'manager', name: ' Manager ' } }))) ?? [];
  assert.deepEqual(blank, { id: 'u-1', name: null, email: null, roleName: 'Manager' });
  const [padded] = readStaff(page(user({ name: '  Wanjiku Kamau ', email: ' w@x.example ' }))) ?? [];
  assert.deepEqual(padded, { id: 'u-1', name: 'Wanjiku Kamau', email: 'w@x.example', roleName: 'Cashier' });
  const [numbers] = readStaff(page(user({ name: 5, email: { a: 1 } }))) ?? [];
  assert.deepEqual(numbers, { id: 'u-1', name: null, email: null, roleName: 'Cashier' });
});

test('a person who comes twice comes once', () => {
  assert.equal(staffOf(page(user(), user(), user({ id: 'u-2', name: 'Another' }))).length, 2);
});

test('the list is alphabetical by name, by email where there is no name, and does not depend on the order it came in', () => {
  const zed = user({ id: 'u-1', name: 'Zed' });
  const amina = user({ id: 'u-2', name: 'amina' });
  const bare = user({ id: 'u-3', name: null, email: 'bare@x.example' });
  const same2 = user({ id: 'u-5', name: 'Same' });
  const same1 = user({ id: 'u-4', name: 'Same' });
  const expected = ['u-2', 'u-3', 'u-4', 'u-5', 'u-1'];
  assert.deepEqual(
    readStaff(page(zed, amina, bare, same2, same1))?.map((p) => p.id),
    expected
  );
  assert.deepEqual(
    readStaff(page(same1, bare, same2, zed, amina))?.map((p) => p.id),
    expected
  );
});

test('no more than the size asked for is read', () => {
  const many = Array.from({ length: STAFF_LIST_SIZE + 5 }, (_, i) => user({ id: `u-${i}`, name: `Person ${i}` }));
  assert.equal(readStaff(page(...many))?.length, STAFF_LIST_SIZE);
});
