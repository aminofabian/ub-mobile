import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, APP_ENTRY_PERMISSIONS, parseMe, type StaffApp, type StaffUser, type TillCheck } from '@kiosk/core';
import { enterApp, enterBranch, type EntryQuestions } from '../src/lib/entry';

const never = <T>(): Promise<T> => new Promise<T>(() => undefined);

function person(overrides: Record<string, unknown> = {}): StaffUser {
  const me = parseMe({
    id: 'u-1',
    email: 'wanjiru@acme.test',
    name: 'Wanjiru Kamau',
    branchId: 'b-1',
    hasPin: true,
    role: { id: 'r-1', key: 'cashier', name: 'Cashier' },
    permissions: ['sales.sell', 'shifts.open'],
    ...overrides,
  });
  assert.ok(me);
  return me;
}

// A person with no branch of their own and a role the server does not pin to one.
const OWNER = { key: 'owner', name: 'Owner' };

const WESTLANDS = { id: 'b-1', name: 'Westlands' };
const KILIMANI = { id: 'b-2', name: ' Kilimani ' };

function ask(overrides: Partial<EntryQuestions> & { user?: StaffUser } = {}) {
  const calls: string[] = [];
  const questions: EntryQuestions = {
    app: 'cashier',
    loadMe: async () => {
      calls.push('me');
      return overrides.user ?? person();
    },
    loadBranches: async () => {
      calls.push('branches');
      return [WESTLANDS, KILIMANI];
    },
    ...overrides,
  };
  return { questions, calls };
}

test('a person on a branch who fits the app goes straight in, with the branch name', async () => {
  const { questions } = ask();
  assert.deepEqual(await enterApp(questions), { name: 'ready', user: person(), branchId: 'b-1', branchName: 'Westlands', shiftsDisabled: false });
});

test('the branch name is only for the header: if it cannot be had the app still opens', async () => {
  const { questions } = ask({ loadBranches: async () => { throw new Error('down'); } });
  const stage = await enterApp(questions);
  assert.equal(stage.name, 'ready');
  assert.equal(stage.name === 'ready' && stage.branchName, null);
  const unlisted = ask({ loadBranches: async () => [KILIMANI] });
  const second = await enterApp(unlisted.questions);
  assert.equal(second.name === 'ready' && second.branchName, null, 'a branch that is not in the list has no name');
});

test('an account that cannot be read stops the sign-in, retryably, and opens nothing', async () => {
  for (const error of [new TypeError('Network request failed'), new ApiError('x', { status: 503 }), new ApiError('x', { status: 403 }), new Error('Could not read your account. Try again.')]) {
    const { questions, calls } = ask({ loadMe: async () => { throw error; } });
    assert.deepEqual(await enterApp(questions), { name: 'check_failed' }, String(error));
    assert.deepEqual(calls, [], 'no branch or till question after a failed account');
  }
});

test('a refused session sends the person back to sign in', async () => {
  const { questions } = ask({ loadMe: async () => { throw new ApiError('Unauthorized', { status: 401 }); } });
  assert.deepEqual(await enterApp(questions), { name: 'signed_out' });
});

test('a role that does not fit the app is told so, with the apps that do fit', async () => {
  const stockManager = person({ role: { key: 'stock_manager', name: 'Stock manager' }, permissions: ['inventory.read', 'stocktake.run'] });
  const { questions, calls } = ask({ user: stockManager });
  const stage = await enterApp(questions);
  assert.deepEqual(stage, { name: 'wrong_app', user: stockManager, fits: ['stock'] });
  assert.deepEqual(calls, ['me'], 'nothing else is asked of someone who cannot use this app');

  const nobody = person({ permissions: ['catalog.read'] });
  assert.deepEqual(await enterApp(ask({ user: nobody }).questions), { name: 'wrong_app', user: nobody, fits: [] });
});

test("the gate follows the app that is asking, not the person's role name", async () => {
  const seller = person({ role: { key: 'till_lead', name: 'Till lead' }, permissions: ['sales.sell'] });
  const apps: StaffApp[] = ['cashier', 'grocery', 'stock', 'admin'];
  const fits: Record<string, boolean> = {};
  for (const app of apps) {
    fits[app] = (await enterApp(ask({ app, user: seller }).questions)).name === 'ready';
  }
  assert.deepEqual(fits, { cashier: true, grocery: false, stock: false, admin: false });
  for (const app of apps) {
    const holder = person({ permissions: [APP_ENTRY_PERMISSIONS[app][0]] });
    assert.equal((await enterApp(ask({ app, user: holder }).questions)).name, 'ready', app);
  }
});

test('a person with no branch of their own picks one from what the server lists', async () => {
  const owner = person({ branchId: null, role: { key: 'owner', name: 'Owner' } });
  const { questions } = ask({ user: owner });
  const stage = await enterApp(questions);
  assert.deepEqual(stage, { name: 'pick_branch', user: owner, branches: [WESTLANDS, KILIMANI] });
  assert.deepEqual(await enterBranch(questions, owner, KILIMANI), { name: 'ready', user: owner, branchId: 'b-2', branchName: 'Kilimani', shiftsDisabled: false });
});

test('a shop with one branch needs no choosing, and one with none says so', async () => {
  const owner = person({ branchId: null, role: OWNER });
  const one = await enterApp(ask({ user: owner, loadBranches: async () => [WESTLANDS] }).questions);
  assert.deepEqual(one, { name: 'ready', user: owner, branchId: 'b-1', branchName: 'Westlands', shiftsDisabled: false });
  assert.deepEqual(await enterApp(ask({ user: owner, loadBranches: async () => [] }).questions), { name: 'no_branch', user: owner });
});

test('branches that cannot be listed are not replaced by an invented one', async () => {
  const owner = person({ branchId: null, role: OWNER });
  const stage = await enterApp(ask({ user: owner, loadBranches: async () => { throw new ApiError('x', { status: 500 }); } }).questions);
  assert.deepEqual(stage, { name: 'branches_failed', user: owner });
  assert.equal(JSON.stringify(stage).includes('Main Branch'), false);
  assert.equal(JSON.stringify(stage).includes('default'), false);
});

test('a phone that was a till here and is not any more is stopped, only where the till question is asked', async () => {
  const answer = (check: TillCheck | Error) => async () => { if (check instanceof Error) throw check; return check; };
  const removed = await enterApp(ask({ checkTill: answer('removed') }).questions);
  assert.deepEqual(removed, { name: 'removed', user: person(), branchId: 'b-1' });
  for (const check of ['registered', 'not_registered', 'unknown'] as const) {
    assert.equal((await enterApp(ask({ checkTill: answer(check) }).questions)).name, 'ready', check);
  }
  assert.equal((await enterApp(ask({ checkTill: answer(new TypeError('offline')) }).questions)).name, 'ready', 'no answer is not "removed"');
  assert.equal((await enterApp(ask().questions)).name, 'ready', 'an app that is not a till never asks');
});

test('an unknown or removed till asks the owner without blocking entry', async () => {
  const asked: string[] = [];
  const askTillAccess = async (branchId: string) => {
    asked.push(branchId);
  };

  assert.equal(
    (await enterApp(ask({ checkTill: async () => 'not_registered', askTillAccess }).questions)).name,
    'ready'
  );
  assert.deepEqual(asked, ['b-1']);

  asked.length = 0;
  assert.equal(
    (await enterApp(ask({ checkTill: async () => 'removed', askTillAccess }).questions)).name,
    'removed'
  );
  assert.deepEqual(asked, ['b-1']);

  asked.length = 0;
  assert.equal(
    (await enterApp(ask({ checkTill: async () => 'registered', askTillAccess }).questions)).name,
    'ready'
  );
  assert.deepEqual(asked, []);
});

test('a shop that is switched off, found when the till is asked about, stops the person instead of letting them sell', async () => {
  const off = await enterApp(ask({ checkTill: async () => 'shop_off' }).questions);
  assert.deepEqual(off, { name: 'shop_off' });
  const owner = person({ branchId: null, role: OWNER });
  assert.deepEqual(await enterBranch(ask({ user: owner, checkTill: async () => 'shop_off' }).questions, owner, KILIMANI), { name: 'shop_off' });
  assert.equal((await enterApp(ask().questions)).name, 'ready', 'an app that does not ask the till question cannot find out this way');
});

test('the till is asked about the branch the person is entering, whichever way it was found', async () => {
  const seen: string[] = [];
  const checkTill = async (branchId: string): Promise<TillCheck> => { seen.push(branchId); return 'registered'; };
  await enterApp(ask({ checkTill }).questions);
  const owner = person({ branchId: null, role: OWNER });
  const { questions } = ask({ user: owner, checkTill });
  await enterBranch(questions, owner, KILIMANI);
  await enterApp(ask({ user: owner, checkTill, loadBranches: async () => [WESTLANDS] }).questions);
  assert.deepEqual(seen, ['b-1', 'b-2', 'b-1']);
});

test('a removed phone is not let in by the branch chooser either', async () => {
  const owner = person({ branchId: null, role: OWNER });
  const { questions } = ask({ user: owner, checkTill: async () => 'removed' });
  assert.deepEqual(await enterBranch(questions, owner, KILIMANI), { name: 'removed', user: owner, branchId: 'b-2' });
});

test('a branch name is trimmed wherever it comes from, and a blank one is no name', async () => {
  const assigned = await enterApp(ask({ user: person({ branchId: 'b-2' }) }).questions);
  assert.equal(assigned.name === 'ready' && assigned.branchName, 'Kilimani', 'the person\'s own branch, named by the list');
  const lone = await enterApp(ask({ user: person({ branchId: null, role: OWNER }), loadBranches: async () => [KILIMANI] }).questions);
  assert.equal(lone.name === 'ready' && lone.branchName, 'Kilimani', 'the only branch of the shop');
  const blank = await enterApp(ask({ user: person({ branchId: null, role: OWNER }), loadBranches: async () => [{ id: 'b-9', name: '   ' }] }).questions);
  assert.equal(blank.name === 'ready' && blank.branchName, null, 'a blank name is no name');
});

test('a role the server pins to one branch, with none assigned, is told so and never offered a choice that would be ignored', async () => {
  const cases: Array<[StaffApp, string]> = [['cashier', 'cashier'], ['cashier', 'butcher_cashier'], ['grocery', 'grocery_clerk'], ['stock', 'stock_manager']];
  for (const [app, key] of cases) {
    const locked = person({ branchId: null, role: { key, name: key }, permissions: [APP_ENTRY_PERMISSIONS[app][0]] });
    const { questions, calls } = ask({ app, user: locked });
    assert.deepEqual(await enterApp(questions), { name: 'no_branch_assigned', user: locked }, `${key} in ${app}`);
    assert.deepEqual(calls, ['me'], `${key}: the branch list is never asked for`);
  }
  // The same people with a branch go in; people the server does not pin are offered the list.
  assert.equal((await enterApp(ask().questions)).name, 'ready');
  for (const key of ['owner', 'manager', 'till_lead']) {
    const free = person({ branchId: null, role: { key, name: key } });
    assert.equal((await enterApp(ask({ user: free }).questions)).name, 'pick_branch', key);
  }
});

test('an account with no role is told so, and nothing else is asked', async () => {
  const roleless = person({ role: null, permissions: ['sales.sell'] });
  const { questions, calls } = ask({ user: roleless });
  assert.deepEqual(await enterApp(questions), { name: 'no_role', user: roleless });
  assert.deepEqual(calls, ['me']);
});

test('a shop that is switched off is told so, not "check your connection"', async () => {
  const off = ask({ loadMe: async () => { throw new ApiError('Locked', { status: 423 }); } });
  assert.deepEqual(await enterApp(off.questions), { name: 'shop_off' });
  const other = ask({ loadMe: async () => { throw new ApiError('Too many', { status: 429 }); } });
  assert.deepEqual(await enterApp(other.questions), { name: 'check_failed' });
});

test('shifts being off is asked only where it matters, and any doubt means shifts are on', async () => {
  const yes = await enterApp(ask({ loadShiftsDisabled: async () => true }).questions);
  assert.equal(yes.name === 'ready' && yes.shiftsDisabled, true);
  for (const answer of [async () => false, async () => { throw new TypeError('offline'); }, async () => 'true' as unknown as boolean, () => never<boolean>()]) {
    const stage = await enterApp(ask({ loadShiftsDisabled: answer }).questions, { secondaryTimeoutMs: 20 });
    assert.equal(stage.name === 'ready' && stage.shiftsDisabled, false);
  }
  const owner = person({ branchId: null, role: OWNER });
  const chosen = await enterBranch(ask({ user: owner, loadShiftsDisabled: async () => true }).questions, owner, KILIMANI);
  assert.equal(chosen.name === 'ready' && chosen.shiftsDisabled, true, 'a chosen branch carries the answer too');
  const asked: string[] = [];
  await enterApp(ask({ loadShiftsDisabled: async () => { asked.push('shifts'); return false; } }).questions);
  await enterApp(ask().questions);
  assert.deepEqual(asked, ['shifts'], 'an app that does not ask is never asked');
});

test('a question that never answers cannot hold the person on "checking": the check fails, retryably', async () => {
  const hung = ask({ loadMe: () => never<StaffUser>() });
  const started = Date.now();
  assert.deepEqual(await enterApp(hung.questions, { timeoutMs: 40 }), { name: 'check_failed' });
  assert.ok(Date.now() - started < 400);
  const owner = person({ branchId: null, role: OWNER });
  assert.deepEqual(await enterApp(ask({ user: owner, loadBranches: () => never<typeof WESTLANDS[]>() }).questions, { timeoutMs: 40 }), { name: 'check_failed' }, 'a branch list that never comes');
  assert.deepEqual(await enterBranch(ask({ user: owner, checkTill: () => never<TillCheck>() }).questions, owner, KILIMANI, { timeoutMs: 40, secondaryTimeoutMs: 1000 }), { name: 'check_failed' }, 'the chosen branch never settles');
});

test('the till check, the branch name and the shifts lookup are given less time than the whole entry, and silence is not a refusal', async () => {
  const slow = ask({
    checkTill: () => never<TillCheck>(),
    loadBranches: () => never<typeof WESTLANDS[]>(),
    loadShiftsDisabled: () => never<boolean>(),
  });
  assert.deepEqual(
    await enterApp(slow.questions, { timeoutMs: 1000, secondaryTimeoutMs: 20 }),
    { name: 'ready', user: person(), branchId: 'b-1', branchName: null, shiftsDisabled: false },
    'the person is let in: no answer is not "removed", has no name, and is not "off"'
  );
});
