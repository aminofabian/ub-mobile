import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePairingCode } from '@kiosk/core';
import { describeCodeProblem, describePairingFailure, describeWrongShop, isSameShop } from '../src/lib/pair-copy';

test('each way a typed code can be wrong has its own plain sentence', () => {
  const sentences = new Set<string>();
  for (const [typed, kind] of [['K7M', 'incomplete'], ['K7M4Q9XDK7M4Q', 'too_long'], ['K7M4Q9O1', 'invalid_characters']] as const) {
    const parse = parsePairingCode(typed);
    assert.equal(parse.kind, kind, typed);
    assert.ok(parse.kind !== 'ok');
    const sentence = describeCodeProblem(parse);
    assert.ok(sentence.length > 10 && sentence.length < 80, sentence);
    sentences.add(sentence);
  }
  assert.equal(sentences.size, 3, 'three problems, three different sentences');
  assert.match(describeCodeProblem({ kind: 'invalid_characters' }), /never I, L, O, 0 or 1/);
});

test('what the server can answer to a code becomes one next step for the person', () => {
  assert.match(describePairingFailure({ kind: 'not_found' }), /couldn't find that code.*new one/);
  assert.match(describePairingFailure({ kind: 'expired' }), /has expired\. Ask your manager for a new one/);
  assert.match(describePairingFailure({ kind: 'used' }), /already used/);
  assert.match(describePairingFailure({ kind: 'refused' }), /didn't work.*new one/);
  assert.match(describePairingFailure({ kind: 'offline' }), /Couldn't reach the server\. Check your internet/);
  const said = new Set((['not_found', 'expired', 'used', 'refused', 'offline'] as const).map((kind) => describePairingFailure({ kind })));
  assert.equal(said.size, 5, 'each answer has its own sentence');
});

test('a code that was already used points a person whose pairing went through, but whose answer was lost, back to sign-in', () => {
  const sentence = describePairingFailure({ kind: 'used' });
  assert.match(sentence, /If you just paired this phone, go back and sign in/);
  assert.match(sentence, /If not, ask your manager for a new one/);
  assert.doesNotMatch(describePairingFailure({ kind: 'expired' }), /sign in/, 'an expired code was never used');
});

test('no sentence about a code shows a status number, a route or a placeholder', () => {
  for (const kind of ['not_found', 'expired', 'used', 'refused', 'offline'] as const) {
    assert.doesNotMatch(describePairingFailure({ kind }), /\b[45]\d\d\b|till-pairing|undefined|null|\[object/i, kind);
  }
});

test('a rate limit says how long to wait when the server said, and never "1 seconds"', () => {
  assert.equal(describePairingFailure({ kind: 'rate_limited', retryAfterSec: 30 }), 'Too many tries. Try again in 30 seconds.');
  assert.equal(describePairingFailure({ kind: 'rate_limited', retryAfterSec: 1 }), 'Too many tries. Try again in 1 second.');
  assert.equal(describePairingFailure({ kind: 'rate_limited' }), 'Too many tries. Try again in a minute.');
  assert.equal(describePairingFailure({ kind: 'rate_limited', retryAfterSec: 0 }), 'Too many tries. Try again in a minute.', 'no wait is no wait given');
});

test('a code for another shop names both shops and the way out', () => {
  const sentence = describeWrongShop('Bobs Hardware', 'Acme Mart');
  assert.match(sentence, /Bobs Hardware/);
  assert.match(sentence, /not Acme Mart/);
  assert.match(sentence, /code for Acme Mart/);
});

test("the server's own id settles whether a code is for the open shop, so a shop that moved its address is still itself", () => {
  const moved = { host: 'old.kiosk.ke', slug: 'old', businessId: 'biz-1' };
  assert.equal(isSameShop('new.kiosk.ke', moved, 'biz-1'), true, 'same id, new address');
  assert.equal(isSameShop('old.kiosk.ke', moved, 'biz-2'), false, 'another id, the same address: it is another shop');
  assert.equal(isSameShop('old.kiosk.ke', moved), true, 'no id in the code: the address decides');
  assert.equal(isSameShop('new.kiosk.ke', moved), false);
  const pending = { host: 'acme.kiosk.ke', slug: 'acme', businessId: 'pending-acme' };
  assert.equal(isSameShop('acme.kiosk.ke', pending, 'biz-9'), true, 'a provisional id is nobody\'s: the address decides');
  assert.equal(isSameShop('bobs.kiosk.ke', pending, 'biz-9'), false);
  assert.equal(isSameShop('acme.kiosk.ke', { host: 'acme.kiosk.ke', slug: 'acme', businessId: '  ' }, 'biz-9'), true, 'a blank id is no id');
  assert.equal(isSameShop('acme.kiosk.ke', { host: 'acme.kiosk.ke', slug: 'acme', businessId: 'biz-1' }, '  '), true, 'a blank id from the server is no id');
});

test('a code belongs to the open shop by its address or its short name, in any case', () => {
  const acme = { host: 'acme.kiosk.ke', slug: 'acme' };
  assert.equal(isSameShop('acme.kiosk.ke', acme), true);
  assert.equal(isSameShop('  ACME.Kiosk.KE ', acme), true);
  assert.equal(isSameShop('acme', acme), true);
  assert.equal(isSameShop('Acme', acme), true);
  assert.equal(isSameShop('bobs.kiosk.ke', acme), false);
  assert.equal(isSameShop('acme.kiosk.ke.evil.com', acme), false, 'a longer address is another shop');
  assert.equal(isSameShop('acm', acme), false, 'a prefix is another shop');
  assert.equal(isSameShop('', acme), false);
  assert.equal(isSameShop('   ', { host: '', slug: '' }), false, 'two blanks are not the same shop');
});
