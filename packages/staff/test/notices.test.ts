import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMe, type StaffUser } from '@kiosk/core';
import { describeEntryNotice, joinNames, shopWebUrl, type NoticeContext, type NoticeStage } from '../src/lib/notices';

function person(roleKey: string, roleName: string, permissions: string[]): StaffUser {
  const me = parseMe({ id: 'u', email: 'a@acme.test', name: 'A', branchId: 'b-1', hasPin: true, role: { key: roleKey, name: roleName }, permissions });
  assert.ok(me);
  return me;
}

const CONTEXT: NoticeContext = { app: 'cashier', shopName: 'Acme Mart', host: 'acme.kiosk.ke' };
const ids = (stage: NoticeStage, context: NoticeContext = CONTEXT) => describeEntryNotice(stage, context).actions.map((a) => a.id);

test('a shop address becomes a web link only when it is a plain host', () => {
  assert.equal(shopWebUrl('acme.kiosk.ke'), 'https://acme.kiosk.ke/');
  assert.equal(shopWebUrl(' ACME.Kiosk.KE ', '/inventory/stock?view=levels'), 'https://acme.kiosk.ke/inventory/stock?view=levels');
  assert.equal(shopWebUrl('palmart.co.ke', '/pharmacy'), 'https://palmart.co.ke/pharmacy');
  assert.equal(shopWebUrl('localhost:3000'), undefined, 'a host with no dot is not a shop address');
  for (const bad of [undefined, '', '  ', 'acme', 'evil.com/path', 'evil.com@acme.ke', 'a b.ke', 'acme.kiosk.ke?x=1', 'https://acme.kiosk.ke', '-a.ke', 'a..ke', `${'a'.repeat(250)}.ke`]) {
    assert.equal(shopWebUrl(bad), undefined, String(bad));
  }
  const label = 'a'.repeat(63);
  assert.equal(shopWebUrl(`${label}.${label}.${label}.${'a'.repeat(61)}`)?.length, 'https://'.length + 253 + '/'.length, 'a 253-character address is the longest allowed');
  assert.equal(shopWebUrl(`${label}.${label}.${label}.${'a'.repeat(62)}`), undefined, 'one more character is too long');
  assert.equal(shopWebUrl(`${label}.${label}.${label}.${label}.${label}`), undefined, 'every label is short, the whole address is not');
  assert.equal(shopWebUrl('acme.kiosk.ke', '//evil.example'), 'https://acme.kiosk.ke/', 'a path that is not a path is dropped');
  assert.equal(shopWebUrl('acme.kiosk.ke', '/a b'), 'https://acme.kiosk.ke/');
  assert.equal(shopWebUrl('acme.kiosk.ke', 'pharmacy'), 'https://acme.kiosk.ke/');
});

test('names are joined the way a person would say them', () => {
  assert.equal(joinNames([]), '');
  assert.equal(joinNames(['Cashier']), 'Cashier');
  assert.equal(joinNames(['Cashier', 'Stock']), 'Cashier and Stock');
  assert.equal(joinNames(['Cashier', 'Stock', 'Admin']), 'Cashier, Stock and Admin');
});

test('an account or branches that could not be loaded say so and offer to try again or sign out', () => {
  for (const name of ['check_failed', 'branches_failed'] as const) {
    const stage = name === 'check_failed' ? { name } : { name, user: person('owner', 'Owner', []) };
    const notice = describeEntryNotice(stage as NoticeStage, CONTEXT);
    assert.deepEqual(ids(stage as NoticeStage), ['retry', 'sign_out']);
    assert.equal(notice.actions[0]?.primary, true);
    assert.match(notice.title, /Couldn't/);
    assert.match(notice.title, name === 'check_failed' ? /account/ : /branches/, 'each says what it could not load');
  }
});

test('the wrong app says what it is for, where the role works, and which app to use instead', () => {
  const stockManager = person('stock_manager', 'Stock manager', ['inventory.read']);
  const notice = describeEntryNotice({ name: 'wrong_app', user: stockManager, fits: ['stock'] }, CONTEXT);
  assert.equal(notice.title, "This app isn't for your account");
  assert.match(notice.body, /The Cashier app is for the till\./);
  assert.match(notice.body, /Your role, Stock manager, works in the stock pages on the web\./);
  assert.match(notice.body, /You can use the Stock app instead\./);
  assert.equal(notice.webUrl, 'https://acme.kiosk.ke/inventory/stock?view=levels');
  assert.deepEqual(notice.actions.map((a) => a.id), ['open_web', 'sign_out']);
  assert.equal(notice.actions[0]?.label, 'Open acme.kiosk.ke');
});

test('the wrong app names several apps, never the one that is asking, and says nothing when none fit', () => {
  const owner = person('owner', 'Owner', []);
  const several = describeEntryNotice({ name: 'wrong_app', user: owner, fits: ['cashier', 'stock', 'admin'] }, CONTEXT);
  assert.match(several.body, /You can use the Stock and Admin apps instead\./);
  assert.doesNotMatch(several.body, /use the Cashier/);
  const none = describeEntryNotice({ name: 'wrong_app', user: owner, fits: [] }, CONTEXT);
  assert.doesNotMatch(none.body, /instead/);
});

test('a role the app does not know is sent to the shop\'s front page, and with no address there is no link', () => {
  const custom = person('till_lead', 'Till lead', []);
  const notice = describeEntryNotice({ name: 'wrong_app', user: custom, fits: [] }, CONTEXT);
  assert.equal(notice.webUrl, 'https://acme.kiosk.ke/');
  const noHost = describeEntryNotice({ name: 'wrong_app', user: custom, fits: [] }, { app: 'grocery' });
  assert.equal(noHost.webUrl, undefined);
  assert.deepEqual(noHost.actions.map((a) => a.id), ['sign_out']);
  assert.match(noHost.body, /The Grocery app is for counter invoices\./);
});

test('a shop with no branch tells the person to add one on the web, with the shop\'s own address', () => {
  const stage = { name: 'no_branch', user: person('owner', 'Owner', []) } as const;
  const notice = describeEntryNotice(stage, CONTEXT);
  assert.match(notice.body, /Add a branch on acme\.kiosk\.ke/);
  assert.deepEqual(notice.actions.map((a) => a.id), ['open_web', 'retry', 'sign_out']);
  assert.equal(notice.actions[1]?.label, 'Check again');
  assert.match(describeEntryNotice(stage, { app: 'cashier' }).body, /Add a branch on the web/);
});

test('a removed phone says so, keeps the unsent sales in view, and offers pairing only when it works', () => {
  const stage = { name: 'removed', user: person('cashier', 'Cashier', []), branchId: 'b-1' } as const;
  const none = describeEntryNotice(stage, CONTEXT);
  assert.equal(none.title, 'This phone was removed from Acme Mart');
  assert.equal(none.body, 'It is no longer a till here. Ask your manager if it should work as a till again.');
  assert.deepEqual(ids(stage), ['sign_out']);

  const some = describeEntryNotice(stage, { ...CONTEXT, unsentCount: 3 });
  assert.match(some.body, /3 sales were not sent and are still on this phone/);
  assert.match(some.body, /Ask your manager if it should work as a till again\.$/, 'with no pairing the person is told who to ask');
  assert.deepEqual(some.actions.map((a) => a.id), ['save_unsent', 'sign_out']);
  assert.equal(some.actions[0]?.primary, true);

  const one = describeEntryNotice(stage, { ...CONTEXT, unsentCount: 1, pairingEnabled: true });
  assert.match(one.body, /1 sale was not sent and is still on this phone\. Save it/);
  assert.match(one.body, /pair it with a new code from your manager\.$/, 'with pairing the person is told how');
  assert.doesNotMatch(one.body, /Ask your manager if it should/);
  assert.deepEqual(one.actions.map((a) => a.id), ['save_unsent', 'pair', 'sign_out']);
  assert.deepEqual(one.actions.map((a) => a.primary ?? false), [true, false, false], 'saving the sales comes before pairing again');

  const paired = describeEntryNotice(stage, { ...CONTEXT, pairingEnabled: true });
  assert.deepEqual(paired.actions.map((a) => [a.id, a.primary ?? false]), [['pair', true], ['sign_out', false]]);
  assert.equal(describeEntryNotice(stage, { app: 'cashier' }).title, 'This phone was removed from this shop');
  assert.equal(describeEntryNotice(stage, { app: 'cashier', shopName: '   ' }).title, 'This phone was removed from this shop', 'a blank name is no name');
});

test('a switched-off shop, an account with no role and a pinned role with no branch each say what to do', () => {
  const user = person('cashier', 'Cashier', []);
  const off = describeEntryNotice({ name: 'shop_off' }, CONTEXT);
  assert.equal(off.title, 'Acme Mart is switched off right now');
  assert.match(off.body, /Ask the owner to contact support/);
  assert.deepEqual(off.actions.map((a) => a.id), ['retry', 'sign_out']);
  assert.equal(describeEntryNotice({ name: 'shop_off' }, { app: 'cashier' }).title, 'this shop is switched off right now');

  const roleless = describeEntryNotice({ name: 'no_role', user }, CONTEXT);
  assert.equal(roleless.title, 'Your account has no role yet');
  assert.match(roleless.body, /Ask your manager to give your account a role, then sign in again/);
  assert.deepEqual(roleless.actions.map((a) => [a.id, a.primary ?? false]), [['sign_out', true]], 'only signing out helps');

  const unassigned = describeEntryNotice({ name: 'no_branch_assigned', user }, CONTEXT);
  assert.equal(unassigned.title, 'You are not on a branch yet');
  assert.match(unassigned.body, /Ask your manager to put you on a branch, then sign in again/);
  assert.deepEqual(unassigned.actions.map((a) => [a.id, a.primary ?? false]), [['sign_out', true]], 'the branch is read at sign-in, so checking again would change nothing');
});

test('an address that is not a plain host is never put in a label, a body or a link', () => {
  const user = person('owner', 'Owner', []);
  for (const host of ['evil.com/path', 'a b.ke', 'acme.kiosk.ke\nCall 0700 000 000', 'javascript:alert(1)']) {
    for (const stage of [{ name: 'no_branch', user }, { name: 'wrong_app', user, fits: [] }, { name: 'no_branch_assigned', user }] as NoticeStage[]) {
      const notice = describeEntryNotice(stage, { app: 'cashier', host });
      assert.equal(notice.webUrl, undefined, host);
      assert.doesNotMatch(JSON.stringify(notice), /evil|Call 0700|javascript/, host);
    }
  }
});

test('no notice shows a code, a status number or a placeholder', () => {
  const user = person('manager', 'Manager', []);
  const stages: NoticeStage[] = [
    { name: 'check_failed' },
    { name: 'shop_off' },
    { name: 'no_role', user },
    { name: 'no_branch_assigned', user },
    { name: 'branches_failed', user },
    { name: 'no_branch', user },
    { name: 'wrong_app', user, fits: ['admin'] },
    { name: 'removed', user, branchId: 'b-1' },
  ];
  for (const stage of stages) {
    for (const context of [CONTEXT, { app: 'stock' as const }, { ...CONTEXT, unsentCount: 2, pairingEnabled: true }]) {
      const notice = describeEntryNotice(stage, context);
      const text = [notice.title, notice.body, ...notice.actions.map((a) => a.label)].join(' ');
      assert.doesNotMatch(text, /\b[45]\d\d\b|setup_required|undefined|null|\[object/i, text);
      assert.ok(notice.title.length > 0 && notice.body.length > 0);
    }
  }
});
