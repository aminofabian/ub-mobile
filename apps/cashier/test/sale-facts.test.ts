import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asOfWords } from '../src/lib/catalog-words';
import { describeFacts, factsFor, readFacts } from '../src/lib/sale-facts';

const NOON = Date.parse('2026-11-23T12:00:00.000Z');
const PERSON = { userId: 'u-1', name: 'Amina' };
const CASH = [{ method: 'cash' }];
const MPESA = [{ method: 'cash' }, { method: 'mpesa_manual' }];

test('a sale with nothing to say about it carries no facts', () => {
  assert.equal(factsFor({ person: null, payments: CASH, mpesaConfirmed: false, pricesAsOf: null }), undefined);
  assert.equal(factsFor({ person: undefined, payments: [], mpesaConfirmed: true, pricesAsOf: undefined }), undefined);
});

test('who rang the sale is kept, as a clean name and an id', () => {
  const facts = factsFor({ person: PERSON, payments: CASH, mpesaConfirmed: false, pricesAsOf: null });
  assert.deepEqual(facts, { rungBy: 'Amina', rungById: 'u-1' });
  const messy = factsFor({ person: { userId: ` u-2 `, name: 'Brian\nOwino\u0007' }, payments: CASH, mpesaConfirmed: false, pricesAsOf: null });
  assert.equal(messy?.rungBy, 'Brian Owino', 'a name is one clean line');
  assert.equal(messy?.rungById, 'u-2');
  const long = factsFor({ person: { userId: 'x'.repeat(500), name: 'N'.repeat(500) }, payments: CASH, mpesaConfirmed: false, pricesAsOf: null });
  assert.ok(String(long?.rungBy).length <= 60);
  assert.ok(String(long?.rungById).length <= 80);
});

test('a code that was typed is marked, and one that a paid prompt gave is not', () => {
  assert.equal(factsFor({ person: null, payments: MPESA, mpesaConfirmed: false, pricesAsOf: null })?.mpesaTyped, true);
  assert.equal(factsFor({ person: null, payments: MPESA, mpesaConfirmed: true, pricesAsOf: null }), undefined);
  assert.equal(factsFor({ person: null, payments: CASH, mpesaConfirmed: false, pricesAsOf: null }), undefined, 'no M-Pesa, nothing typed');
});

test('the age of the phone list a price came from is kept only when it is a time', () => {
  assert.equal(factsFor({ person: null, payments: CASH, mpesaConfirmed: false, pricesAsOf: NOON })?.pricesAsOf, NOON);
  assert.equal(factsFor({ person: null, payments: CASH, mpesaConfirmed: false, pricesAsOf: NOON + 0.9 })?.pricesAsOf, NOON, 'whole milliseconds');
  for (const bad of [NaN, Infinity, -1, null, undefined]) {
    assert.equal(factsFor({ person: null, payments: CASH, mpesaConfirmed: false, pricesAsOf: bad as never }), undefined, String(bad));
  }
});

test('facts are read back defensively: only what was written, in the shape it was written', () => {
  assert.deepEqual(readFacts({}), {});
  assert.deepEqual(readFacts({ facts: null }), {});
  assert.deepEqual(readFacts({ facts: 'rungBy' }), {});
  assert.deepEqual(readFacts({ facts: ['rungBy', 'Amina'] }), {});
  assert.deepEqual(readFacts({ facts: { rungBy: 7, rungById: '', mpesaTyped: 'yes', pricesAsOf: '5', other: true } }), {});
  assert.deepEqual(
    readFacts({ facts: { rungBy: 'Amina', rungById: 'u-1', mpesaTyped: true, pricesAsOf: NOON } }),
    { rungBy: 'Amina', rungById: 'u-1', mpesaTyped: true, pricesAsOf: NOON }
  );
  assert.equal(readFacts({ facts: { rungBy: 'A\nB' } }).rungBy, 'A B', 'what is shown is one line, whatever was stored');
  assert.deepEqual(readFacts({ facts: { pricesAsOf: -5 } }), {});
});

test('what is said about a sale: who rang it, an unchecked code, the age of its prices', () => {
  const item = { facts: { rungBy: 'Amina', mpesaTyped: true, pricesAsOf: NOON } };
  const waiting = describeFacts(item, { now: NOON + 60_000, stuck: false });
  assert.deepEqual(waiting, [
    'Rung by Amina.',
    'The M-Pesa code was typed in. Nothing has checked it yet.',
    `Priced from this phone's list, ${asOfWords(NOON, NOON + 60_000)}.`,
  ]);
  const stuck = describeFacts(item, { now: NOON + 60_000, stuck: true });
  assert.match(stuck[2], /A price may have changed since\.$/, 'a sale that needs a person is told the likely reason');
  assert.doesNotMatch(waiting[2], /may have changed/);
  assert.deepEqual(describeFacts({}, { now: NOON, stuck: true }), []);
  assert.deepEqual(describeFacts({ facts: { rungById: 'u-1' } }, { now: NOON, stuck: false }), [], 'an id alone says nothing to a person');
});
