import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { canSubmitSignIn, cleanEmail, cleanPin, isEmailComplete } from '../src/lib/sign-in-form';
import { LOCK_HINT_AFTER, NO_WRONG_TRIES, countWrongTries, describeSignInProblem, type SignInProblemContext } from '../src/lib/sign-in-problems';

const PIN: SignInProblemContext = { method: 'pin', shopName: 'Acme Mart' };
const PASSWORD: SignInProblemContext = { method: 'password', shopName: 'Acme Mart' };

test('the PIN box keeps only digits, six at most', () => {
  assert.equal(cleanPin('1234'), '1234');
  assert.equal(cleanPin('12 34'), '1234');
  assert.equal(cleanPin('12a34b'), '1234');
  assert.equal(cleanPin('1234567890'), '123456');
  assert.equal(cleanPin('١٢٣٤'), '', 'only ASCII digits count');
  assert.equal(cleanPin(''), '');
});

test('the email is trimmed and lower case, and must look like an address before it is sent', () => {
  assert.equal(cleanEmail('  Wanjiru@Acme.Test '), 'wanjiru@acme.test');
  assert.equal(isEmailComplete(' a@b.co '), true);
  for (const bad of ['', 'a', 'a@', 'a@b', '@b.co', 'a b@c.co', 'a@b .co', `${'x'.repeat(200)}@b.co`]) {
    assert.equal(isEmailComplete(bad), false, bad);
  }
});

test('the button is ready only when the form is: a PIN of 4 to 6 digits, or a password', () => {
  const email = 'a@b.co';
  assert.equal(canSubmitSignIn({ method: 'pin', email, pin: '1234', password: '' }), true);
  assert.equal(canSubmitSignIn({ method: 'pin', email, pin: '123456', password: '' }), true);
  assert.equal(canSubmitSignIn({ method: 'pin', email, pin: '123', password: '' }), false);
  assert.equal(canSubmitSignIn({ method: 'pin', email, pin: '1234567', password: '' }), false);
  assert.equal(canSubmitSignIn({ method: 'pin', email, pin: '12a4', password: '' }), false);
  assert.equal(canSubmitSignIn({ method: 'pin', email: 'a@b', pin: '1234', password: '' }), false);
  assert.equal(canSubmitSignIn({ method: 'pin', email, pin: '', password: 'secret' }), false, 'a typed password does not count in PIN mode');
  assert.equal(canSubmitSignIn({ method: 'password', email, pin: '', password: 'secret' }), true);
  assert.equal(canSubmitSignIn({ method: 'password', email, pin: '1234', password: '' }), false);
});

const api = (status: number, code?: string, message = 'whatever the server said') => new ApiError(message, { status, ...(code ? { code } : {}) });

test('a wrong PIN or password is said plainly, and the secret is cleared but the email stays', () => {
  const pin = describeSignInProblem(api(401), PIN);
  assert.deepEqual([pin.kind, pin.clearSecret], ['wrong_credentials', true]);
  assert.match(pin.message, /email and PIN/);
  const password = describeSignInProblem(api(401), PASSWORD);
  assert.match(password.message, /email and password/);
  assert.equal(password.clearSecret, true);
});

test('a phone that is not an approved till is told so, by code or by the 403 a PIN sign-in gets', () => {
  for (const error of [api(403, 'till_not_registered'), api(403)]) {
    const problem = describeSignInProblem(error, PIN);
    assert.equal(problem.kind, 'not_approved_till');
    assert.match(problem.message, /Acme Mart/);
    assert.equal(problem.clearSecret, false, 'the PIN was right');
    assert.equal(problem.action, undefined, 'no pairing offered while it is off');
  }
  assert.equal(describeSignInProblem(api(403), { ...PIN, pairingEnabled: true }).action, 'pair');
  assert.equal(describeSignInProblem(api(403, 'till_not_registered'), { ...PASSWORD, pairingEnabled: true }).kind, 'not_approved_till', 'the code wins over the method');
});

test('with the server\'s code the phone is said to be the problem; without it the words cover an account that is not active yet too', () => {
  const sure = describeSignInProblem(api(403, 'till_not_registered'), PIN).message;
  assert.match(sure, /^This phone isn't approved as a till at Acme Mart yet\. Your manager has been asked to approve it\./);
  const guess = describeSignInProblem(api(403), PIN).message;
  assert.match(guess, /may not be approved as a till at Acme Mart/);
  assert.match(guess, /account may not be active yet/);
  assert.match(guess, /\(if so, your manager has been asked to approve it\)/, 'a promise only where it holds');
  assert.doesNotMatch(guess, /^This phone isn't approved/);
});

test('a person who keeps getting the wrong PIN is told the account may be locked, but not before the third time', () => {
  assert.equal(LOCK_HINT_AFTER, 3);
  for (const tries of [undefined, 0, 1, 2]) {
    const said = describeSignInProblem(api(401), { ...PIN, failedTries: tries }).message;
    assert.equal(said, "That email and PIN don't match. Try again.", String(tries));
  }
  for (const tries of [3, 4, 20]) {
    const said = describeSignInProblem(api(401), { ...PIN, failedTries: tries }).message;
    assert.match(said, /^That email and PIN don't match\. If it keeps happening, your account may be locked: ask your manager\.$/, String(tries));
  }
  assert.match(describeSignInProblem(api(401), { ...PASSWORD, failedTries: 3 }).message, /email and password don't match\. If it keeps happening/);
  assert.equal(describeSignInProblem(api(401), { ...PIN, failedTries: 5 }).clearSecret, true, 'the box is still cleared');
  assert.doesNotMatch(describeSignInProblem(api(500), { ...PIN, failedTries: 9 }).message, /locked/, 'only a wrong PIN says it');
});

test('an unverified email offers to send the link again, by code or by the 403 a password sign-in gets', () => {
  for (const error of [api(403, 'email_not_verified'), api(403)]) {
    const problem = describeSignInProblem(error, PASSWORD);
    assert.equal(problem.kind, 'email_not_verified');
    assert.equal(problem.action, 'resend_verification');
  }
  assert.equal(describeSignInProblem(api(403, 'email_not_verified'), PIN).kind, 'email_not_verified', 'the code wins over the method');
});

test('a switched-off shop, too many tries, a down server and no connection each say their own thing', () => {
  assert.equal(describeSignInProblem(api(423), PIN).kind, 'shop_off');
  assert.match(describeSignInProblem(api(423), PIN).message, /Acme Mart is switched off/);
  assert.equal(describeSignInProblem(api(429), PIN).kind, 'too_many');
  for (const status of [500, 502, 503, 408]) {
    assert.equal(describeSignInProblem(api(status), PIN).kind, 'server_down', String(status));
  }
  for (const offline of [new TypeError('Network request failed'), Object.assign(new Error('Aborted'), { name: 'AbortError' })]) {
    const problem = describeSignInProblem(offline, PIN);
    assert.deepEqual([problem.kind, problem.clearSecret], ['no_connection', false]);
  }
});

test('a rejected form shows what the server said, cleaned; anything else is a plain "try again"', () => {
  const rejected = describeSignInProblem(api(400, undefined, 'PIN must be 4 to 6 digits‮'), PIN);
  assert.deepEqual([rejected.kind, rejected.message], ['rejected', 'PIN must be 4 to 6 digits']);
  assert.equal(describeSignInProblem(api(400, undefined, ''), PIN).kind, 'unknown');
  assert.equal(describeSignInProblem(api(418), PIN).kind, 'unknown');
  assert.equal(describeSignInProblem(new Error('Login failed: no access token'), PIN).kind, 'unknown');
  assert.equal(describeSignInProblem('boom', PIN).kind, 'unknown');
  assert.equal(describeSignInProblem(null, PIN).kind, 'unknown');
});

test('wrong tries are counted per person, and only wrong PINs or passwords count', () => {
  let tries = NO_WRONG_TRIES;
  tries = countWrongTries(tries, 'a@b.co', 'wrong_credentials');
  tries = countWrongTries(tries, 'a@b.co', 'wrong_credentials');
  assert.deepEqual(tries, { email: 'a@b.co', count: 2 });
  assert.deepEqual(countWrongTries(tries, 'a@b.co', 'no_connection'), tries, 'no connection is not a wrong try');
  assert.deepEqual(countWrongTries(tries, 'a@b.co', 'server_down'), tries);
  assert.deepEqual(countWrongTries(tries, 'a@b.co', 'too_many'), tries);
  assert.deepEqual(countWrongTries(tries, 'a@b.co', 'not_approved_till'), tries);
  assert.deepEqual(countWrongTries(tries, 'a@b.co', 'wrong_credentials'), { email: 'a@b.co', count: 3 });
  assert.deepEqual(countWrongTries(tries, 'c@d.co', 'wrong_credentials'), { email: 'c@d.co', count: 1 }, 'another person starts again');
  assert.deepEqual(countWrongTries(tries, 'c@d.co', 'no_connection'), tries, 'a non-wrong try for another person changes nothing');
  assert.deepEqual(NO_WRONG_TRIES, { email: '', count: 0 }, 'the starting count is never changed');
});

test('the lock hint shows on the third wrong try in a row for the same person, through the same words the screen uses', () => {
  let tries = NO_WRONG_TRIES;
  const said: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const base = describeSignInProblem(api(401), PIN);
    tries = countWrongTries(tries, 'a@b.co', base.kind);
    said.push(describeSignInProblem(api(401), { ...PIN, failedTries: tries.email === 'a@b.co' ? tries.count : 0 }).message);
  }
  assert.deepEqual(said.map((text) => text.includes('may be locked')), [false, false, true, true]);
});

test('no sentence shows a status number, a code, or the word "error"', () => {
  const errors = [api(401), api(403), api(403, 'till_not_registered'), api(403, 'email_not_verified'), api(423), api(429), api(500), api(400, undefined, 'x'), api(418), new TypeError('x'), new Error('x')];
  for (const error of errors) {
    for (const context of [PIN, PASSWORD, { method: 'pin' as const }, { method: 'pin' as const, pairingEnabled: true }]) {
      const { message } = describeSignInProblem(error, context);
      assert.doesNotMatch(message, /\b[45]\d\d\b|till_not_registered|email_not_verified|setup_required|\berror\b|undefined|null/i, message);
    }
  }
  assert.match(describeSignInProblem(api(403), { method: 'pin' }).message, /this shop/, 'a missing shop name reads naturally');
});

test("the shop's name is cleaned before it sits inside a sentence, and a missing name reads as 'this shop'", () => {
  const hostile = `Acme‮\u0000 \n Mart${' x'.repeat(100)}`;
  for (const error of [new ApiError('x', { status: 423 }), new ApiError('x', { status: 403, code: 'till_not_registered' })]) {
    const said = describeSignInProblem(error, { method: 'pin', shopName: hostile }).message;
    assert.doesNotMatch(said, /[\u0000-\u001F‮]/, 'no control characters or direction marks');
    assert.match(said, /Acme Mart x/, 'the readable part is kept');
    assert.ok(said.length < 200, 'a long name is cut');
    for (const blank of [undefined, '', '   ', '‮​']) {
      assert.match(describeSignInProblem(error, { method: 'pin', shopName: blank }).message, /this shop/, JSON.stringify(blank));
    }
  }
});
