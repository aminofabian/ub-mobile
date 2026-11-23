import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endsSessionOn, holdsWork, judgeSignIn, mayFollowShopLink, sessionLossMatters, wantsEntryAnswer, type ShellStageName } from '../src/lib/shell-guards';

const ALL: ShellStageName[] = [
  'signin',
  'checking',
  'signing_out',
  'pairing',
  'check_failed',
  'shop_off',
  'no_role',
  'wrong_app',
  'branches_failed',
  'no_branch',
  'no_branch_assigned',
  'pick_branch',
  'removed',
  'ready',
];

test('a lost session is news only to a session that was in use', () => {
  for (const stage of ['signin', 'pairing', 'signing_out'] as const) {
    assert.equal(sessionLossMatters(stage), false, `${stage} has no session to lose`);
  }
  for (const stage of ALL.filter((name) => !['signin', 'pairing', 'signing_out'].includes(name))) {
    assert.equal(sessionLossMatters(stage), true, `${stage} had one`);
  }
});

test('a sign-in that comes back is used, ended or dropped, by the shop and the screen', () => {
  assert.equal(judgeSignIn('acme', { shop: 'acme', stage: 'signin' }), 'use');
  for (const stage of ALL.filter((name) => name !== 'signin')) {
    assert.equal(judgeSignIn('acme', { shop: 'acme', stage }), 'end', `the person has left the sign-in screen for ${stage}`);
  }
  for (const stage of ALL) {
    assert.equal(judgeSignIn('acme', { shop: 'bobs', stage }), 'drop', `another shop is open (${stage})`);
    assert.equal(judgeSignIn('acme', { shop: undefined, stage }), 'drop', `no shop is open (${stage})`);
  }
  assert.equal(judgeSignIn('', { shop: '', stage: 'signin' }), 'drop', 'two blanks are not the same shop');
  assert.equal(judgeSignIn('', { shop: undefined, stage: 'signin' }), 'drop');
});

test('an entry answer is wanted only from the latest attempt, at the shop it was asked for', () => {
  assert.equal(wantsEntryAnswer({ attempt: 3, shop: 'acme' }, { attempt: 3, shop: 'acme' }), true);
  assert.equal(wantsEntryAnswer({ attempt: 3, shop: 'acme' }, { attempt: 4, shop: 'acme' }), false, 'something newer started');
  assert.equal(wantsEntryAnswer({ attempt: 3, shop: 'acme' }, { attempt: 3, shop: 'bobs' }), false, 'the phone moved to another shop');
  assert.equal(wantsEntryAnswer({ attempt: 3, shop: 'acme' }, { attempt: 3, shop: undefined }), false, 'no shop is open');
  assert.equal(wantsEntryAnswer({ attempt: 3, shop: 'acme' }, { attempt: 2, shop: 'acme' }), false, 'an attempt from the future is not this one');
});

test('work is in hand while the person is signed in and not yet on a screen that is only a notice', () => {
  for (const stage of ALL) {
    assert.equal(holdsWork(stage), ['ready', 'checking', 'pick_branch'].includes(stage), stage);
  }
});

test('while someone is working, only a link to the shop that is open is followed', () => {
  const here = { slug: 'acme', host: 'acme.kiosk.ke' };
  const other = { slug: 'bobs', host: null };
  const sameBySlug = { slug: 'acme', host: null };
  const sameByHost = { slug: null, host: 'acme.kiosk.ke' };
  for (const stage of ['ready', 'checking', 'pick_branch'] as const) {
    assert.equal(mayFollowShopLink(stage, other, here), false, `${stage}: another shop waits`);
    assert.equal(mayFollowShopLink(stage, { slug: 'bobs', host: 'bobs.kiosk.ke' }, here), false);
    assert.equal(mayFollowShopLink(stage, sameBySlug, here), true, `${stage}: the same shop changes nothing`);
    assert.equal(mayFollowShopLink(stage, sameByHost, here), true);
    assert.equal(mayFollowShopLink(stage, { slug: ' ACME ', host: null }, here), true, 'in any case');
    assert.equal(mayFollowShopLink(stage, { slug: null, host: null }, here), false, 'a link naming nothing is not the open shop');
    assert.equal(mayFollowShopLink(stage, { slug: '', host: '' }, { slug: '', host: '' }), false, 'two blanks are not the same shop');
  }
  for (const stage of ALL.filter((name) => !['ready', 'checking', 'pick_branch'].includes(name))) {
    assert.equal(mayFollowShopLink(stage, other, here), true, `${stage}: nobody is working`);
  }
  assert.equal(mayFollowShopLink('ready', null, here), true, 'not a shop link: the handler ignores it');
  assert.equal(mayFollowShopLink('ready', other, null), true, 'no shop is open');
});

test('the session is ended on exactly the screens that cannot use it', () => {
  const ended = ['wrong_app', 'removed', 'no_role', 'no_branch_assigned'];
  for (const stage of ALL) {
    if (stage === 'signin' || stage === 'checking' || stage === 'signing_out' || stage === 'pairing') continue;
    assert.equal(endsSessionOn(stage), ended.includes(stage), stage);
  }
  for (const needsIt of ['check_failed', 'shop_off', 'branches_failed', 'no_branch', 'pick_branch', 'ready']) {
    assert.equal(endsSessionOn(needsIt as never), false, `${needsIt} offers a way that needs the session`);
  }
});
