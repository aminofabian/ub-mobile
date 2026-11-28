import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '@kiosk/core';
import {
  checkPayment,
  confirmPaymentWords,
  customerPath,
  describePaymentFailure,
  doubtActions,
  firstNameOf,
  MAX_TABS,
  paymentBody,
  paymentVerdict,
  readBalance,
  readCreditSummary,
  readPaymentAnswer,
  readTabs,
  reminderText,
  sortTabs,
  tabsPath,
  totalOwedCents,
  verdictWords,
  type CreditTab,
} from '../src/lib/credit';

function tab(over: Partial<CreditTab> = {}): CreditTab {
  return { customerId: 'c-1', name: 'Wanjiku', phone: '0712345678', owedCents: 125_000, suspended: false, verified: false, phoneId: null, ...over };
}

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { customerId: 'c-1', name: 'Wanjiku', primaryPhone: '0712 345 678', balanceOwed: '1250.00', creditSuspended: false, ...over };
}

test('the list of open tabs is read, the biggest first, with each phone ready to dial', () => {
  const read = readTabs([row({ customerId: 'c-1', balanceOwed: '300.00' }), row({ customerId: 'c-2', name: 'Otieno', balanceOwed: 1250.5, creditSuspended: true, primaryPhone: null })]);
  assert.deepEqual(read, {
    tabs: [
      { customerId: 'c-2', name: 'Otieno', phone: null, owedCents: 125_050, suspended: true, verified: false, phoneId: null },
      { customerId: 'c-1', name: 'Wanjiku', phone: '0712345678', owedCents: 30_000, suspended: false, verified: false, phoneId: null },
    ],
    omitted: 0,
  });
});

test('a page is read like a list, and an answer that is neither is a failed read and not "nobody owes anything"', () => {
  assert.equal(readTabs({ content: [row()] })?.tabs.length, 1);
  assert.deepEqual(readTabs([]), { tabs: [], omitted: 0 });
  for (const bad of [null, undefined, 'x', 5, {}, { tabs: [row()] }, { content: 'x' }]) assert.equal(readTabs(bad), null, JSON.stringify(bad));
});

test('a row that is not a tab the owner can take a payment on is left out', () => {
  const read = readTabs([
    row({ customerId: 'ok' }),
    row({ customerId: 'zero', balanceOwed: '0.00' }),
    row({ customerId: 'owed-to-them', balanceOwed: '-5.00' }),
    row({ customerId: 'words', balanceOwed: 'a lot' }),
    row({ customerId: 'none', balanceOwed: undefined }),
    row({ customerId: '' }),
    row({ customerId: 'x'.repeat(65) }),
    row({ customerId: 'ok' }),
    null,
    'x',
    [],
  ]);
  assert.deepEqual(read?.tabs.map((t) => t.customerId), ['ok']);
});

test('a name is cleaned, a missing one is "Customer", and only a plain true suspends credit', () => {
  const read = readTabs([row({ customerId: 'a', name: '  Wanjiku   Kamau ' }), row({ customerId: 'b', name: '', creditSuspended: 'true' }), row({ customerId: 'c', name: null, creditSuspended: true })]);
  const byId = Object.fromEntries((read?.tabs ?? []).map((t) => [t.customerId, t]));
  assert.equal(byId.a?.name, 'Wanjiku Kamau');
  assert.equal(byId.b?.name, 'Customer');
  assert.equal(byId.b?.suspended, false);
  assert.equal(byId.c?.suspended, true);
});

test('no more than the biggest three hundred tabs are kept, and the rest are counted', () => {
  const rows = Array.from({ length: MAX_TABS + 25 }, (_, i) => row({ customerId: `c-${i}`, balanceOwed: String(i + 1) }));
  const read = readTabs(rows);
  assert.equal(read?.tabs.length, MAX_TABS);
  assert.equal(read?.omitted, 25);
  assert.equal(read?.tabs[0]?.customerId, `c-${MAX_TABS + 24}`);
  assert.equal(read?.tabs.at(-1)?.owedCents, 26 * 100);
});

test('tabs of the same size keep a steady order, by name and then by id', () => {
  const sorted = sortTabs([
    tab({ customerId: 'z', name: 'Beta', owedCents: 100 }),
    tab({ customerId: 'y', name: 'Alpha', owedCents: 100 }),
    tab({ customerId: 'x', name: 'Alpha', owedCents: 100 }),
    tab({ customerId: 'w', name: 'Zed', owedCents: 500 }),
  ]);
  assert.deepEqual(sorted.map((t) => t.customerId), ['w', 'x', 'y', 'z']);
});

test('sorting does not change the list it was given', () => {
  const input = [tab({ customerId: 'a', owedCents: 1 }), tab({ customerId: 'b', owedCents: 2 })];
  sortTabs(input);
  assert.deepEqual(input.map((t) => t.customerId), ['a', 'b']);
});

test('what is owed is the sum of the tabs', () => {
  assert.equal(totalOwedCents([]), 0);
  assert.equal(totalOwedCents([tab({ owedCents: 125_000 }), tab({ owedCents: 5 })]), 125_005);
});

test('the paths are spelled for a web address and a search is cleaned', () => {
  assert.equal(tabsPath(''), '/api/v1/customers/outstanding-tabs');
  assert.equal(tabsPath('   '), '/api/v1/customers/outstanding-tabs');
  assert.equal(tabsPath('wanj'), '/api/v1/customers/outstanding-tabs?q=wanj');
  assert.equal(tabsPath(' Wan jiru&x=1 '), '/api/v1/customers/outstanding-tabs?q=Wan%20jiru%26x%3D1');
  assert.equal(tabsPath('x'.repeat(100)), `/api/v1/customers/outstanding-tabs?q=${'x'.repeat(60)}`);
  assert.equal(customerPath('c-1'), '/api/v1/customers/c-1');
  assert.equal(customerPath('a/b?c'), '/api/v1/customers/a%2Fb%3Fc');
});

test('the credit summary is read into cents and counts, and a part that is not sent is not known', () => {
  assert.deepEqual(readCreditSummary({ totalPaid: '2000.00', paymentCount: 4, totalOwed: '24300.50', openTabCount: 17, collections: [] }), {
    owedCents: 2_430_050,
    openTabs: 17,
    collectedCents: 200_000,
    paymentCount: 4,
  });
  assert.deepEqual(readCreditSummary({}), { owedCents: null, openTabs: null, collectedCents: null, paymentCount: null });
  assert.equal(readCreditSummary({ openTabCount: -1, paymentCount: 1.5 })?.openTabs, null);
  assert.equal(readCreditSummary({ openTabCount: -1, paymentCount: 1.5 })?.paymentCount, null);
  for (const bad of [null, undefined, 'x', 5, []]) assert.equal(readCreditSummary(bad), null, JSON.stringify(bad));
});

test('what is typed for a payment must be an amount, more than nothing and no more than is owed', () => {
  assert.deepEqual(checkPayment(125_000, '500'), { ok: true, cents: 50_000 });
  assert.deepEqual(checkPayment(125_000, '1250'), { ok: true, cents: 125_000 });
  assert.deepEqual(checkPayment(125_000, '0.01'), { ok: true, cents: 1 });
  assert.deepEqual(checkPayment(125_000, ' 12.5 '), { ok: true, cents: 1_250 });
  assert.deepEqual(checkPayment(125_000, ''), { ok: false, words: 'Type how much was paid.' });
  assert.deepEqual(checkPayment(125_000, '   '), { ok: false, words: 'Type how much was paid.' });
  assert.deepEqual(checkPayment(125_000, '1,250'), { ok: false, words: 'Type an amount like 500 or 500.50, with no commas or letters.' });
  assert.deepEqual(checkPayment(125_000, 'abc'), { ok: false, words: 'Type an amount like 500 or 500.50, with no commas or letters.' });
  assert.deepEqual(checkPayment(125_000, '0'), { ok: false, words: 'The amount must be more than zero.' });
  assert.deepEqual(checkPayment(125_000, '0.00'), { ok: false, words: 'The amount must be more than zero.' });
  assert.deepEqual(checkPayment(125_000, '1250.01'), { ok: false, words: 'This tab is only KES 1,250.00. A payment cannot be more than what is owed.' });
});

test('a payment is sent as a money figure, with an M-Pesa code only for M-Pesa', () => {
  assert.deepEqual(paymentBody({ customerId: ' c-1 ', cents: 50_050, channel: 'cash', reference: 'ignored' }), { customerId: 'c-1', amount: 500.5, channel: 'cash' });
  assert.deepEqual(paymentBody({ customerId: 'c-1', cents: 50_000, channel: 'mpesa', reference: ' SK12ABC34D ' }), { customerId: 'c-1', amount: 500, channel: 'mpesa', reference: 'SK12ABC34D' });
  assert.deepEqual(paymentBody({ customerId: 'c-1', cents: 50_000, channel: 'mpesa', reference: '   ' }), { customerId: 'c-1', amount: 500, channel: 'mpesa' });
  assert.equal(paymentBody({ customerId: 'c-1', cents: 50_000, channel: 'mpesa', reference: 'r'.repeat(300) })?.reference?.length, 128);
});

test('a payment that cannot be written as money, or has no customer, is never sent', () => {
  for (const cents of [0, -1, 1.5, Number.NaN, 99_999_999_999 + 1]) assert.equal(paymentBody({ customerId: 'c-1', cents, channel: 'cash', reference: '' }), null, String(cents));
  assert.equal(paymentBody({ customerId: '  ', cents: 100, channel: 'cash', reference: '' }), null);
});

test('what the server said about a payment is read, and a body that cannot be read leaves the balance unknown and the payment recorded', () => {
  assert.deepEqual(readPaymentAnswer({ claimId: 'cl-9', balanceOwed: '750.00' }), { claimId: 'cl-9', balanceCents: 75_000 });
  assert.deepEqual(readPaymentAnswer({ claimId: 'cl-9', balanceOwed: '0.00' }), { claimId: 'cl-9', balanceCents: 0 });
  assert.deepEqual(readPaymentAnswer({ claimId: '  ', balanceOwed: 'lots' }), { claimId: null, balanceCents: null });
  for (const bad of [null, undefined, '', 'created', 5]) assert.deepEqual(readPaymentAnswer(bad), { claimId: null, balanceCents: null });
});

test('what a customer owes is read from the customer, and nothing is guessed when it is not there', () => {
  assert.equal(readBalance({ id: 'c-1', credit: { balanceOwed: '750.00', walletBalance: '0.00' } }), 75_000);
  assert.equal(readBalance({ credit: { balanceOwed: 0 } }), 0);
  for (const bad of [null, undefined, 'x', {}, { credit: null }, { credit: 'x' }, { credit: {} }, { credit: { balanceOwed: 'lots' } }, { credit: { balanceOwed: '-5.00' } }]) {
    assert.equal(readBalance(bad), null, JSON.stringify(bad));
  }
});

test('a payment that got no answer is settled by the balance read again, never by sending it again', () => {
  const settle = (owedNowCents: number | null) => paymentVerdict({ owedBeforeCents: 125_000, paidCents: 50_000, owedNowCents });
  assert.equal(settle(75_000), 'went_through');
  assert.equal(settle(125_000), 'not_seen');
  assert.equal(settle(0), 'changed');
  assert.equal(settle(100_000), 'changed');
  assert.equal(settle(150_000), 'changed');
  assert.equal(settle(null), 'unknown');
});

test('a payment of the whole tab is settled the same way', () => {
  const settle = (owedNowCents: number | null) => paymentVerdict({ owedBeforeCents: 125_000, paidCents: 125_000, owedNowCents });
  assert.equal(settle(0), 'went_through');
  assert.equal(settle(125_000), 'not_seen');
  assert.equal(settle(1), 'changed');
});

test('a reminder names the customer by first name, the shop and what is owed', () => {
  assert.equal(
    reminderText({ shop: 'Palmart', name: 'Wanjiku Kamau', owedCents: 125_050 }),
    'Hello Wanjiku, a friendly reminder from Palmart: your tab is KES 1,250.50. Please settle when you can. Thank you.'
  );
  assert.match(reminderText({ shop: '  ', name: '   ', owedCents: 100 }), /^Hello there, a friendly reminder from the shop: your tab is KES 1\.00\./);
});

test('each answer to "did the payment go through?" says what is known, and none of them tells the owner to send it again', () => {
  const said = (verdict: Parameters<typeof verdictWords>[0], owedNowCents: number | null) => verdictWords(verdict, { paidCents: 50_000, owedNowCents });
  assert.deepEqual(said('went_through', 75_000), { tone: 'ok', words: 'Recorded: KES 500.00 paid. They now owe KES 750.00.' });
  const notSeen = said('not_seen', 125_000);
  assert.equal(notSeen.tone, 'warn');
  assert.match(notSeen.words, /does not show on the tab yet/);
  assert.match(notSeen.words, /KES 500\.00/);
  assert.match(notSeen.words, /credited twice/);
  const changed = said('changed', 100_000);
  assert.equal(changed.tone, 'warn');
  assert.match(changed.words, /The tab is now KES 1,000\.00/);
  assert.match(changed.words, /Look at the tab on the web/);
  const unknown = said('unknown', null);
  assert.equal(unknown.tone, 'warn');
  assert.match(unknown.words, /Could not check/);
  assert.match(unknown.words, /Do not enter it twice/);
  for (const verdict of ['not_seen', 'changed', 'unknown'] as const) {
    assert.doesNotMatch(said(verdict, 1).words, /try again|send it again/i, verdict);
  }
});

test('a payment the server turned down says so, and one that may have been applied is a doubt', () => {
  const fail = (status: number, extra: { foreign?: boolean; hint?: string } = {}, message = 'x') => new ApiError(message, { status, ...extra });
  assert.deepEqual(describePaymentFailure(fail(403)), { kind: 'refused', words: 'Your role is not allowed to record payments. Ask the owner of the shop to allow it.' });
  assert.deepEqual(describePaymentFailure(fail(404)), { kind: 'refused', words: 'That customer is no longer on the list. Go back and open the list again.' });
  assert.deepEqual(describePaymentFailure(fail(400, { hint: 'Payment exceeds balance' })), { kind: 'refused', words: 'Payment exceeds balance' });
  assert.deepEqual(describePaymentFailure(fail(422, {}, 'Amount must be positive')), { kind: 'refused', words: 'Amount must be positive' });
  for (const doubt of [fail(500), fail(502), fail(401), fail(408), fail(423), fail(429), fail(403, { foreign: true }), new Error('offline'), 'timeout', null]) {
    assert.deepEqual(describePaymentFailure(doubt), { kind: 'doubt' });
  }
  const long = describePaymentFailure(fail(400, { hint: 'z'.repeat(400) }));
  assert.equal(long.kind, 'refused');
  assert.ok(long.kind === 'refused' && long.words.length <= 140);
});

test('a customer id may be as long as sixty-four characters and no longer', () => {
  assert.equal(readTabs([row({ customerId: 'x'.repeat(64) })])?.tabs.length, 1);
  assert.equal(readTabs([row({ customerId: 'x'.repeat(65) })])?.tabs.length, 0);
});

test('a count of nothing is a count, and a count that is not whole is not known', () => {
  assert.deepEqual(readCreditSummary({ totalOwed: '0', openTabCount: 0, totalPaid: '0', paymentCount: 0 }), { owedCents: 0, openTabs: 0, collectedCents: 0, paymentCount: 0 });
  assert.deepEqual(readCreditSummary({ totalOwed: '10.00', openTabCount: -1, totalPaid: '5.00', paymentCount: 1.5 }), { owedCents: 1000, openTabs: null, collectedCents: 500, paymentCount: null });
});

test('a search for a number is sent as the digits every way of writing it shares, and a name is sent as typed', () => {
  assert.equal(tabsPath('0712 345'), '/api/v1/customers/outstanding-tabs?q=712345');
  assert.equal(tabsPath('+254 712 345 678'), '/api/v1/customers/outstanding-tabs?q=712345678');
  assert.equal(tabsPath('Wanjiku'), '/api/v1/customers/outstanding-tabs?q=Wanjiku');
  assert.equal(tabsPath('Shop 24'), '/api/v1/customers/outstanding-tabs?q=Shop%2024');
  assert.equal(tabsPath('  '), '/api/v1/customers/outstanding-tabs');
});

test('a reminder greets the first word of a name that reads as a name, and says "there" for anything else', () => {
  const shop = 'Palmart';
  const hello = (name: string) => reminderText({ shop, name, owedCents: 125_000 }).split(',')[0];
  assert.equal(hello('Mary Wanjiku'), 'Hello Mary');
  assert.equal(hello("O'Brien Kamau"), "Hello O'Brien");
  assert.equal(hello('Jean-Luc'), 'Hello Jean-Luc');
  assert.equal(hello('Dr. Otieno'), 'Hello Dr.');
  assert.equal(hello('Njeri'), 'Hello Njeri');
  assert.equal(hello('Wafula'), 'Hello Wafula');
  assert.equal(hello('Amélie'), 'Hello Amélie');
  for (const bad of ['Jane2', '---', "'", 'https://evil.example/pay Jane', 'evil.example Jane', 'www.evil.com', '0712345678 Jane', '@everyone', 'a/b', '<b>Jane</b>', '', '   ', '!!!', 'J.R. Ewing', 'x'.repeat(40)]) {
    assert.equal(hello(bad), 'Hello there', JSON.stringify(bad));
  }
  assert.equal(firstNameOf('Mary Wanjiku'), 'Mary');
  assert.equal(firstNameOf('1234'), null);
});

test('the reminder says what is owed and who it is from', () => {
  assert.equal(
    reminderText({ shop: 'Palmart', name: 'Mary Wanjiku', owedCents: 125_000 }),
    'Hello Mary, a friendly reminder from Palmart: your tab is KES 1,250.00. Please settle when you can. Thank you.'
  );
});

test('a payment that got no answer offers looking again always, and letting go only once the tab has been seen', () => {
  assert.deepEqual(doubtActions('not_seen'), [
    { key: 'check', label: 'Check again' },
    { key: 'carry_on', label: 'I checked. It is not there' },
  ]);
  assert.deepEqual(doubtActions('changed'), [
    { key: 'check', label: 'Check again' },
    { key: 'carry_on', label: 'I have looked. Carry on' },
  ]);
  // The tab could not be read, so nothing has been checked and there is nothing to let go of.
  assert.deepEqual(doubtActions('unknown'), [{ key: 'check', label: 'Check again' }]);
  assert.deepEqual(doubtActions('went_through'), [{ key: 'check', label: 'Check again' }]);
});

test('the question before a payment is recorded says who paid, how, what is left, that the customer may be texted and that it cannot be taken back', () => {
  const asked = confirmPaymentWords({ name: 'Wanjiku', paidCents: 50_000, channel: 'mpesa', owedAfterCents: 75_000 });
  assert.equal(asked.title, 'Record this payment?');
  assert.equal(
    asked.message,
    'Wanjiku paid KES 500.00 by M-Pesa. They will owe KES 750.00 after this. The customer may get a text message about it. The phone cannot take a payment back.'
  );
  assert.match(confirmPaymentWords({ name: 'W', paidCents: 100, channel: 'cash', owedAfterCents: 0 }).message, /paid KES 1\.00 in cash\. They will owe KES 0\.00/);
});

test('no character that could turn a name into a link, a command or markup is repeated in a reminder', () => {
  for (const ch of ['#', '?', '&', '=', '%', '*', '_', '~', '|', '^', '$', '+', ';', ',', '"', '`', '!', '[', ']', '(', ')', '{', '}', '<', '>', '@', ':', '/', '\\', '0', '7']) {
    assert.equal(firstNameOf(`Jane${ch}`), null, `Jane${ch}`);
    assert.equal(firstNameOf(`${ch}Jane`), null, `${ch}Jane`);
  }
  for (const ok of ["O'Brien", 'Jean-Luc', 'Dr.', 'Njeri', 'Amélie', 'Chebet']) assert.equal(firstNameOf(ok), ok, ok);
});
