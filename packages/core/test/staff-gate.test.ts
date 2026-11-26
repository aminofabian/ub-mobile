import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore, freshPhone, installFetch } from './support/world.mjs';
import { configureStorage } from '../src/storage';
import * as K from '../src/storage-keys';
import { ApiError } from '../src/problem';
import type { ApiClient } from '../src/create-api-client';
import { forgetStore, openStore } from '../src/tenant';
import { readTenantValue } from '../src/tenant-data';
import { parseMe } from '../src/staff-user';
import {
  APP_ENTRY_PERMISSIONS,
  APP_JOBS,
  APP_NAMES,
  STAFF_APPS,
  BRANCH_LOCKED_ROLE_KEYS,
  appsThatFit,
  fitsApp,
  isBranchLockedRole,
  webHomeForRole,
} from '../src/role-gate';
import { asSetupRequired, describeFailure, describeSetup } from '../src/setup-required';
import { checkTillRegistration, forgetTillRegistered, interpretTillAnswer, rememberTillRegistered } from '../src/till-status';
import {
  MAX_KNOWN_STAFF,
  addKnownStaff,
  clearKnownStaff,
  firstName,
  forgetKnownStaff,
  loadKnownStaff,
  parseKnownStaff,
  rememberStaff,
  removeKnownStaff,
  serializeKnownStaff,
} from '../src/known-staff';
import { ACME, API, BOBS, mobileBody, mobileUrl } from './fixtures';

let restore: (() => void) | null = null;

beforeEach(() => {
  freshPhone({});
  configureStorage(null);
});

afterEach(() => {
  restore?.();
  restore = null;
});

async function open(slug: 'acme' | 'bobs') {
  restore?.();
  const net = installFetch([
    [mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }],
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
  ]);
  restore = () => net.restore();
  const result = await openStore(slug, API, { audience: 'staff' });
  assert.equal(result.kind, 'opened', JSON.stringify(result));
}

// ---------------------------------------------------------------------------------------------
// Which app a person's permissions fit
// ---------------------------------------------------------------------------------------------

const PERSON = {
  id: 'u-1',
  email: 'a@acme.test',
  name: 'A',
  branchId: 'b-1',
  hasPin: true,
  role: { id: 'r-1', key: 'cashier', name: 'Cashier' },
  permissions: ['sales.sell'],
};

test("every app has a name, a job and entry permissions written in the server's form", () => {
  for (const app of STAFF_APPS) {
    assert.ok(APP_NAMES[app].length > 0);
    assert.ok(APP_JOBS[app].length > 0);
    assert.ok(APP_ENTRY_PERMISSIONS[app].length > 0);
    assert.equal(new Set(APP_ENTRY_PERMISSIONS[app]).size, APP_ENTRY_PERMISSIONS[app].length, `${app} has a repeat`);
    for (const permission of APP_ENTRY_PERMISSIONS[app]) {
      assert.match(permission, /^[a-z0-9][a-z0-9_.:-]{0,79}$/, permission);
    }
  }
});

test("the cashier's ten till permissions are exactly the ten the server calls till work", () => {
  assert.deepEqual(
    [...APP_ENTRY_PERMISSIONS.cashier].sort(),
    [
      'pos.drafts.write',
      'sales.payment.adjust',
      'sales.refund.create',
      'sales.sell',
      'sales.void.any',
      'sales.void.own',
      'sales.weighed.refund',
      'shifts.close',
      'shifts.open',
      'shifts.update',
    ]
  );
});

test("the other apps' entry permissions are pinned too, so a change is a decision and not a slip", () => {
  assert.deepEqual([...APP_ENTRY_PERMISSIONS.grocery].sort(), [
    'grocery.invoices.cancel',
    'grocery.invoices.create',
    'grocery.invoices.pay',
    'grocery.invoices.read',
  ]);
  assert.deepEqual([...APP_ENTRY_PERMISSIONS.stock].sort(), ['inventory.read', 'inventory.write', 'stocktake.read', 'stocktake.run']);
  assert.deepEqual([...APP_ENTRY_PERMISSIONS.admin].sort(), [
    'business.manage_settings',
    'finance.reports.read',
    'reports.inventory.read',
    'reports.sales.read',
    'storefront.orders.read',
    'users.list',
  ]);
});

test('one entry permission is enough for an app, and none is not', () => {
  for (const app of STAFF_APPS) {
    for (const permission of APP_ENTRY_PERMISSIONS[app]) {
      assert.equal(fitsApp(app, [permission]), true, `${app} / ${permission}`);
    }
    assert.equal(fitsApp(app, []), false, app);
    assert.equal(fitsApp(app, ['catalog.read', 'customers.list']), false, `${app} with unrelated permissions`);
  }
});

test('a role is judged by its permissions, not its name: a custom role that sells is a cashier', () => {
  const custom = parseMe({ ...PERSON, role: { id: 'r-9', key: 'till_lead', name: 'Till lead' }, permissions: ['sales.sell'] });
  assert.ok(custom);
  assert.deepEqual(appsThatFit(custom.permissions), ['cashier']);
  const byName = parseMe({ ...PERSON, permissions: ['catalog.read'] });
  assert.ok(byName);
  assert.deepEqual(appsThatFit(byName.permissions), [], 'a role named cashier with no till permission fits no app');
});

test("an owner-like person fits several apps, in the apps' fixed order", () => {
  assert.deepEqual(appsThatFit([...APP_ENTRY_PERMISSIONS.admin, 'stocktake.run', 'sales.sell']), ['cashier', 'stock', 'admin']);
  assert.deepEqual(appsThatFit([]), []);
});

test('the web place for a role is for display only, ignores case, and falls back for a role it does not know', () => {
  assert.deepEqual(webHomeForRole('PHARMACIST'), webHomeForRole('pharmacist'));
  assert.equal(webHomeForRole('pharmacist').path, '/pharmacy');
  assert.deepEqual(webHomeForRole('till_lead'), { where: 'the web', path: '/' });
  assert.deepEqual(webHomeForRole(''), { where: 'the web', path: '/' });
  for (const key of ['owner', 'admin', 'manager', 'viewer', 'cashier', 'butcher_cashier', 'grocery_clerk', 'stock_manager', 'pharmacist', 'waiter', 'kitchen_staff', 'service_staff', 'clinician', 'nurse', 'clinic_receptionist']) {
    const home = webHomeForRole(key);
    assert.ok(home.where.length > 0 && home.path.startsWith('/'), key);
  }
});

// ---------------------------------------------------------------------------------------------
// setup_required
// ---------------------------------------------------------------------------------------------

function setupError(requirement: string | undefined, hint?: string, code = 'setup_required') {
  return new ApiError('x', { status: 403, code, ...(requirement ? { requirement } : {}), ...(hint ? { hint } : {}) });
}

test('a setup_required error says which setup step is missing; anything else is not one', () => {
  assert.deepEqual(asSetupRequired(setupError('shift')), { requirement: 'shift' });
  assert.deepEqual(asSetupRequired(setupError('branch', 'pick')), { requirement: 'branch', hint: 'pick' });
  for (const requirement of ['branch', 'shift', 'till', 'dispensing']) {
    assert.equal(asSetupRequired(setupError(requirement))?.requirement, requirement);
  }
  assert.equal(asSetupRequired(setupError('lunch')), null, 'an unknown step is not acted on');
  assert.equal(asSetupRequired(setupError(undefined)), null);
  assert.equal(asSetupRequired(setupError('shift', undefined, 'forbidden')), null);
  assert.equal(asSetupRequired(new Error('setup_required')), null, 'a message is never read');
  assert.equal(asSetupRequired(null), null);
});

test('a failed action shows the setup step when the server asked for one, and its own words otherwise', () => {
  const fallback = { title: 'Could not open shift', body: 'Try again.' };
  const asked = describeFailure(setupError('shift'), fallback, { app: 'cashier' });
  assert.equal(asked.title, 'Open a shift to start selling');
  assert.equal(asked.setup?.action, 'open_shift');
  assert.equal(asked.body, asked.setup?.body);
  const web = describeFailure(setupError('dispensing', 'pick'), fallback, { web: 'acme.kiosk.ke' });
  assert.match(web.body, /acme\.kiosk\.ke/);
  assert.equal(web.setup?.action, 'finish_on_web');

  const plain = describeFailure(new ApiError('Not enough stock for Milk', { status: 409 }), fallback);
  assert.deepEqual(plain, { title: 'Could not open shift', body: 'Not enough stock for Milk' }, "the server's words, under our title");
  assert.equal(plain.setup, undefined);
  assert.deepEqual(describeFailure(new Error('   '), fallback), fallback, 'a blank message falls back');
  assert.deepEqual(describeFailure('boom', fallback), fallback, 'something that is not an Error falls back');
  assert.deepEqual(describeFailure(null, fallback), fallback);
  assert.equal(describeFailure(setupError('lunch'), fallback).title, 'Could not open shift', 'an unknown step is not acted on');
});

test("the server's own words in a failure are cleaned and capped, and a page in their place is not words", () => {
  const fallback = { title: 'Could not open shift', body: 'Try again.' };
  const dirty = describeFailure(new Error('Not enough\u202e stock\n for   Milk\u0000'), fallback);
  assert.equal(dirty.body, 'Not enough stock for Milk');
  const long = describeFailure(new Error('x'.repeat(500)), fallback);
  assert.equal(long.body.length, 200);
  assert.deepEqual(describeFailure(new Error('<html><body>502 Bad Gateway</body></html>'), fallback), fallback);
  assert.deepEqual(describeFailure(new Error('\u202e\u200b'), fallback), fallback, 'nothing left after cleaning falls back');
});

test('only a plain host is put in a sentence: anything else says "the web"', () => {
  for (const bad of ['acme.kiosk.ke/<script>', 'acme.kiosk.ke\nCall 0700 000 000', 'javascript:alert(1)', 'https://acme.kiosk.ke', 'a b.ke', 'localhost', 'x'.repeat(300) + '.ke']) {
    for (const needed of [{ requirement: 'branch', hint: 'none' }, { requirement: 'shift' }, { requirement: 'till' }, { requirement: 'dispensing' }] as const) {
      const body = describeSetup(needed, { web: bad, app: 'grocery' }).body;
      assert.doesNotMatch(body, /script|Call 0700|javascript|https:/, `${needed.requirement}: ${bad.slice(0, 20)}`);
    }
  }
  assert.match(describeSetup({ requirement: 'shift' }, { web: 'Acme.Kiosk.KE:8443', app: 'grocery' }).body, /acme\.kiosk\.ke:8443/);
});

test('the roles the server pins to one branch are these four, in any case, and nobody else', () => {
  assert.deepEqual([...BRANCH_LOCKED_ROLE_KEYS], ['stock_manager', 'cashier', 'grocery_clerk', 'butcher_cashier']);
  for (const key of BRANCH_LOCKED_ROLE_KEYS) {
    assert.equal(isBranchLockedRole(key), true, key);
    assert.equal(isBranchLockedRole(` ${key.toUpperCase()} `), true, `${key} upper case`);
  }
  for (const other of ['owner', 'admin', 'manager', 'viewer', 'cashier2', 'my_cashier', '', '  ']) {
    assert.equal(isBranchLockedRole(other), false, other);
  }
  assert.equal(isBranchLockedRole(null), false);
  assert.equal(isBranchLockedRole(undefined), false);
});

test('every setup step has a plain title, a body and no machine words', () => {
  const steps = [
    { requirement: 'branch', hint: 'none' },
    { requirement: 'branch', hint: 'assign' },
    { requirement: 'branch', hint: 'pick' },
    { requirement: 'branch' },
    { requirement: 'shift' },
    { requirement: 'till' },
    { requirement: 'dispensing' },
  ] as const;
  for (const needed of steps) {
    for (const context of [{}, { app: 'cashier' as const }, { app: 'cashier' as const, shiftsDisabled: true }, { pairingEnabled: true }]) {
      const step = describeSetup(needed, context);
      assert.equal(step.requirement, needed.requirement);
      assert.ok(step.title.length > 0 && step.body.length > 0);
      assert.doesNotMatch(`${step.title} ${step.body}`, /setup_required|requirement|\b40\d\b|\bhint\b|exception|null/i);
    }
  }
});

test("steps finished on the web name the shop's own address, and say 'the web' when it is not known", () => {
  const needs = [{ requirement: 'branch', hint: 'none' }, { requirement: 'shift' }, { requirement: 'till' }, { requirement: 'dispensing' }] as const;
  for (const needed of needs) {
    assert.match(describeSetup(needed, { web: ' acme.kiosk.ke ' }).body, /acme\.kiosk\.ke/, needed.requirement);
    assert.match(describeSetup(needed).body, /the web/, needed.requirement);
    assert.match(describeSetup(needed, { web: '   ' }).body, /the web/, `${needed.requirement} with a blank address`);
  }
  assert.match(describeSetup({ requirement: 'till' }, { web: 'acme.kiosk.ke', pairingEnabled: true }).body, /acme\.kiosk\.ke/);
  assert.doesNotMatch(JSON.stringify([describeSetup({ requirement: 'shift' }), describeSetup({ requirement: 'till' })]), /kiosk\.ke/, 'the platform name is not hard-coded');
});

test('the next step depends on what the person can do on this phone', () => {
  assert.equal(describeSetup({ requirement: 'branch', hint: 'none' }).action, 'finish_on_web');
  assert.equal(describeSetup({ requirement: 'branch', hint: 'assign' }).action, 'ask_manager');
  assert.equal(describeSetup({ requirement: 'branch', hint: 'pick' }).action, 'pick_branch');
  assert.equal(describeSetup({ requirement: 'branch' }).action, 'pick_branch');
  assert.equal(describeSetup({ requirement: 'shift' }, { app: 'cashier' }).action, 'open_shift');
  assert.equal(describeSetup({ requirement: 'shift' }, { app: 'cashier', shiftsDisabled: true }).action, 'finish_on_web');
  assert.equal(describeSetup({ requirement: 'shift' }, { app: 'grocery' }).action, 'finish_on_web');
  assert.equal(describeSetup({ requirement: 'shift' }).action, 'finish_on_web');
  assert.equal(describeSetup({ requirement: 'till' }, { pairingEnabled: true }).action, 'pair');
  assert.equal(describeSetup({ requirement: 'till' }, { pairingEnabled: false }).action, 'ask_manager');
  assert.equal(describeSetup({ requirement: 'till' }).action, 'ask_manager');
  assert.equal(describeSetup({ requirement: 'dispensing' }).action, 'finish_on_web');
  assert.doesNotMatch(describeSetup({ requirement: 'till' }).body, /scan/i, 'no QR is offered while pairing is off');
  assert.match(describeSetup({ requirement: 'till' }, { pairingEnabled: true }).body, /scan/i);
});

// ---------------------------------------------------------------------------------------------
// Is this phone still a till
// ---------------------------------------------------------------------------------------------

test('a 404 only means "removed" for a phone that was known to be registered here', () => {
  assert.equal(interpretTillAnswer('registered', false), 'registered');
  assert.equal(interpretTillAnswer('registered', true), 'registered');
  assert.equal(interpretTillAnswer('not_found', true), 'removed');
  assert.equal(interpretTillAnswer('not_found', false), 'not_registered');
  assert.equal(interpretTillAnswer('failed', true), 'unknown');
  assert.equal(interpretTillAnswer('failed', false), 'unknown');
  assert.equal(interpretTillAnswer('shop_off', true), 'shop_off');
  assert.equal(interpretTillAnswer('shop_off', false), 'shop_off');
});

function tillApi(respond: () => unknown): ApiClient {
  return {
    get: async (path: string) => {
      assert.match(path, /^\/api\/v1\/till-devices\/me\?branchId=/);
      return respond();
    },
  } as unknown as ApiClient;
}

const notFound = () => {
  throw new ApiError('Not found', { status: 404 });
};

test('a phone is "removed" only after it was seen registered at that branch', async () => {
  const id = ACME.tenantId;
  assert.equal(await checkTillRegistration(tillApi(notFound), id, 'b-1'), 'not_registered', 'never seen: not removed');
  assert.equal(await readTenantValue('tillSeen', id), null);

  assert.equal(await checkTillRegistration(tillApi(() => ({ id: 'till' })), id, 'b-1'), 'registered');
  assert.equal(await readTenantValue('tillSeen', id), 'b-1');

  assert.equal(await checkTillRegistration(tillApi(notFound), id, 'b-1'), 'removed');
  assert.equal(await checkTillRegistration(tillApi(notFound), id, 'b-2'), 'not_registered', 'another branch it was never at');
});

test('no answer is not "removed": offline and server errors change nothing', async () => {
  const id = ACME.tenantId;
  await rememberTillRegistered(id, 'b-1');
  const down = tillApi(() => {
    throw new TypeError('Network request failed');
  });
  assert.equal(await checkTillRegistration(down, id, 'b-1'), 'unknown');
  const broken = tillApi(() => {
    throw new ApiError('Request failed (500)', { status: 500 });
  });
  assert.equal(await checkTillRegistration(broken, id, 'b-1'), 'unknown');
  const refused = tillApi(() => {
    throw new ApiError('Forbidden', { status: 403 });
  });
  assert.equal(await checkTillRegistration(refused, id, 'b-1'), 'unknown', 'a 403 is not a 404');
  assert.equal(await readTenantValue('tillSeen', id), 'b-1', 'what was known stays known');
});

test('a switched-off shop answers 423, which is said so and never taken for a removed phone', async () => {
  const id = ACME.tenantId;
  await rememberTillRegistered(id, 'b-1');
  const off = tillApi(() => {
    throw new ApiError('Locked', { status: 423 });
  });
  assert.equal(await checkTillRegistration(off, id, 'b-1'), 'shop_off');
  assert.equal(await readTenantValue('tillSeen', id), 'b-1', 'a switched-off shop does not make the phone forgotten');
  const busy = tillApi(() => {
    throw new ApiError('Too many', { status: 429 });
  });
  assert.equal(await checkTillRegistration(busy, id, 'b-1'), 'unknown', 'only 423 means switched off');
});

test('forgetting that a phone was a till makes a later 404 an ordinary "not registered"', async () => {
  const id = ACME.tenantId;
  await rememberTillRegistered(id, 'b-1');
  await forgetTillRegistered(id);
  assert.equal(await checkTillRegistration(tillApi(notFound), id, 'b-1'), 'not_registered');
});

test('the till question carries the branch, encoded', async () => {
  let asked = '';
  const api = {
    get: async (path: string) => {
      asked = path;
      return {};
    },
  } as unknown as ApiClient;
  await checkTillRegistration(api, ACME.tenantId, 'a b&c');
  assert.equal(asked, '/api/v1/till-devices/me?branchId=a%20b%26c');
});

// ---------------------------------------------------------------------------------------------
// Remembered staff
// ---------------------------------------------------------------------------------------------

test('a chip shows the first name only', () => {
  assert.equal(firstName('Wanjiru Kamau'), 'Wanjiru');
  assert.equal(firstName('  Otieno  '), 'Otieno');
  assert.equal(firstName(''), '');
  assert.equal(firstName('A‮B C'), 'AB');
});

test('stored staff are read defensively: bad JSON, wrong shapes, bad emails and repeats are dropped', () => {
  assert.deepEqual(parseKnownStaff(null), []);
  assert.deepEqual(parseKnownStaff(''), []);
  assert.deepEqual(parseKnownStaff('{not json'), []);
  assert.deepEqual(parseKnownStaff('{"email":"a@b.co"}'), []);
  assert.deepEqual(
    parseKnownStaff(JSON.stringify([null, 5, 'x', { name: 'No Email' }, { email: 'bad' }, { email: 'A@B.CO', name: 'Amina Bett' }, { email: 'a@b.co', name: 'Dup' }])),
    [{ email: 'a@b.co', name: 'Amina' }]
  );
});

test('only six people are kept, the newest first, and the oldest fall off', () => {
  let people = parseKnownStaff(null);
  for (let i = 1; i <= 8; i += 1) {
    people = addKnownStaff(people, { email: `p${i}@acme.test`, name: `Person ${i}` });
  }
  assert.equal(people.length, MAX_KNOWN_STAFF);
  assert.equal(people[0]?.email, 'p8@acme.test');
  assert.equal(people[MAX_KNOWN_STAFF - 1]?.email, 'p3@acme.test');
  const many = JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ email: `q${i}@acme.test`, name: 'Q' })));
  assert.equal(parseKnownStaff(many).length, MAX_KNOWN_STAFF);
  const eight = Array.from({ length: 8 }, (_, i) => ({ email: `r${i}@acme.test`, name: 'R' }));
  assert.equal((JSON.parse(serializeKnownStaff(eight)) as unknown[]).length, MAX_KNOWN_STAFF, 'nothing past six is ever written');
});

test('signing in again moves a person to the front, once, with the email in lower case', () => {
  let people = addKnownStaff([], { email: 'a@acme.test', name: 'Ann Lee' });
  people = addKnownStaff(people, { email: 'b@acme.test', name: 'Bo' });
  people = addKnownStaff(people, { email: 'A@Acme.Test', name: 'Ann Lee' });
  assert.deepEqual(people.map((p) => p.email), ['a@acme.test', 'b@acme.test']);
  assert.deepEqual(addKnownStaff(people, { email: 'not an email', name: 'X' }), people);
  assert.deepEqual(removeKnownStaff(people, 'B@ACME.TEST').map((p) => p.email), ['a@acme.test']);
  assert.deepEqual(removeKnownStaff(people, 'nobody@acme.test'), people);
  assert.deepEqual(parseKnownStaff(serializeKnownStaff(people)), people);
});

test('the list is kept per shop, and "Not you?" takes one person off', async () => {
  await open('acme');
  await rememberStaff({ email: 'ann@acme.test', name: 'Ann Lee' });
  await rememberStaff({ email: 'bo@acme.test', name: 'Bo Ouma' });
  assert.deepEqual((await loadKnownStaff()).map((p) => p.name), ['Bo', 'Ann']);
  assert.deepEqual(await loadKnownStaff(BOBS.tenantId), [], 'another shop has its own list');

  await forgetKnownStaff('ann@acme.test');
  assert.deepEqual((await loadKnownStaff()).map((p) => p.name), ['Bo']);
  await forgetKnownStaff('bo@acme.test');
  assert.equal(asyncStore.__store.has(K.plainKey(ACME.tenantId, 'knownStaff')), false, 'an empty list leaves nothing behind');

  await rememberStaff({ email: 'cy@acme.test', name: 'Cy' });
  await clearKnownStaff();
  assert.deepEqual(await loadKnownStaff(), []);
});

test('with no shop open, nothing is remembered', async () => {
  await rememberStaff({ email: 'ann@acme.test', name: 'Ann' });
  assert.deepEqual(await loadKnownStaff(), []);
});

test('forgetting a shop forgets who signed in at it and that the phone was a till there', async () => {
  await open('acme');
  await rememberStaff({ email: 'ann@acme.test', name: 'Ann Lee' });
  await rememberTillRegistered(ACME.tenantId, 'b-1');
  await open('bobs');
  await rememberStaff({ email: 'bea@bobs.test', name: 'Bea' }, BOBS.tenantId);

  await forgetStore(ACME.tenantId);
  assert.equal(asyncStore.__store.has(K.plainKey(ACME.tenantId, 'knownStaff')), false);
  assert.equal(asyncStore.__store.has(K.plainKey(ACME.tenantId, 'tillSeen')), false);
  assert.deepEqual((await loadKnownStaff(BOBS.tenantId)).map((p) => p.name), ['Bea'], 'the other shop is untouched');
});

test('the staff-app fields are per-shop plain fields like the rest', () => {
  for (const field of ['knownStaff', 'tillSeen', 'heldBaskets', 'catalog', 'shopFlags', 'tillLog'] as const) {
    assert.ok((K.PLAIN_FIELDS as readonly string[]).includes(field), field);
    assert.notEqual(K.plainKey(ACME.tenantId, field), K.plainKey(BOBS.tenantId, field));
  }
});
