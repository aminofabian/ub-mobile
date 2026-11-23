import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraOffText, problemCopy, type EntryMethod, type Problem } from '../src/lib/picker-copy';

const METHODS: EntryMethod[] = ['name', 'address', 'code', 'scan', 'link', 'demo', 'recent'];
const PROBLEMS: Problem[] = [
  { kind: 'not_found' },
  { kind: 'offline' },
  { kind: 'rate_limited' },
  { kind: 'rate_limited', retryAfterSec: 30 },
  { kind: 'unavailable', reason: 'suspended' },
  { kind: 'unavailable', reason: 'storefront_disabled' },
  { kind: 'unavailable', reason: 'not_listed' },
  { kind: 'not_a_shop' },
];

test('a name that matches nothing says so, quotes what was typed, and points to the shop code', () => {
  const copy = problemCopy({ kind: 'not_found' }, { method: 'name', input: '  fresh   mart ', codesEnabled: true });
  assert.equal(copy.title, 'No shop found');
  assert.equal(copy.body, 'We could not find "fresh mart". Ask the cashier for the shop code.');
  assert.deepEqual(copy.actions, ['type_code']);
});

test('before shop codes exist, nobody is told to ask for one', () => {
  const copy = problemCopy({ kind: 'not_found' }, { method: 'name', input: 'fresh', codesEnabled: false });
  assert.equal(copy.body, 'We could not find "fresh". Check the spelling, or look for the short name on a receipt or shelf tag.');
  assert.deepEqual(copy.actions, []);
});

test('whatever goes wrong, with codes switched off the copy never sends the person to a code', () => {
  for (const method of METHODS.filter((entry) => entry !== 'code')) {
    for (const problem of PROBLEMS) {
      const copy = problemCopy(problem, { method, input: 'x', codesEnabled: false });
      assert.doesNotMatch(`${copy.title} ${copy.body}`, /shop code|type the code|the code|that code|a code/i, `${method} ${problem.kind}`);
      assert.equal(copy.actions.includes('type_code'), false, `${method} ${problem.kind}`);
    }
  }
});

test('every problem has a title, a sentence and a full stop, however the person got there', () => {
  for (const codesEnabled of [true, false]) {
    for (const method of METHODS) {
      for (const problem of PROBLEMS) {
        const copy = problemCopy(problem, { method, input: 'acme', codesEnabled });
        assert.ok(copy.title.length > 3, `${method} ${problem.kind} title`);
        assert.match(copy.body, /\.$/, `${method} ${problem.kind} body ends the sentence`);
        assert.ok(new Set(copy.actions).size === copy.actions.length, 'no action twice');
      }
    }
  }
});

test('a code nobody has says that, and spells out the letters that are never used', () => {
  const copy = problemCopy({ kind: 'not_found' }, { method: 'code', input: 'K7M4Q', codesEnabled: true });
  assert.equal(copy.title, 'No shop has that code');
  assert.match(copy.body, /never I, L, O, 0 or 1/);
  assert.deepEqual(copy.actions, ['type_code']);
});

test('a scan that finds nothing offers to scan again, and a link that finds nothing offers search', () => {
  assert.deepEqual(problemCopy({ kind: 'not_found' }, { method: 'scan', codesEnabled: true }).actions, ['scan_again', 'search']);
  assert.deepEqual(problemCopy({ kind: 'not_found' }, { method: 'link', codesEnabled: true }).actions, ['search']);
  assert.match(problemCopy({ kind: 'not_found' }, { method: 'link', codesEnabled: true }).body, /may be old/);
  assert.equal(problemCopy({ kind: 'not_a_shop' }, { method: 'scan', codesEnabled: true }).title, 'That is not a shop');
  assert.deepEqual(problemCopy({ kind: 'not_a_shop' }, { method: 'scan', codesEnabled: false }).actions, ['scan_again', 'search']);
});

test('being offline or rate limited can be tried again; a shop that is closed cannot', () => {
  assert.deepEqual(problemCopy({ kind: 'offline' }, { method: 'name', codesEnabled: true }).actions, ['retry']);
  assert.deepEqual(problemCopy({ kind: 'rate_limited' }, { method: 'name', codesEnabled: true }).actions, ['retry']);
  assert.equal(problemCopy({ kind: 'rate_limited', retryAfterSec: 30 }, { method: 'name', codesEnabled: true }).body, 'Try again in 30 seconds.');
  assert.equal(problemCopy({ kind: 'rate_limited', retryAfterSec: 1 }, { method: 'name', codesEnabled: true }).body, 'Try again in 1 second.');
  assert.equal(problemCopy({ kind: 'rate_limited' }, { method: 'name', codesEnabled: true }).body, 'Try again in a minute.');
  assert.deepEqual(problemCopy({ kind: 'unavailable', reason: 'suspended' }, { method: 'name', codesEnabled: true }).actions, []);
});

test('a shop that cannot be opened is named when the phone knows its name', () => {
  const store = { businessId: 'x', slug: 'acme', host: 'acme.kiosk.ke', displayName: 'Acme Mart', branding: {}, fetchedAt: '2026-01-01T00:00:00Z' };
  assert.equal(problemCopy({ kind: 'unavailable', reason: 'suspended', store }, { method: 'link', codesEnabled: true }).title, 'Acme Mart is not available right now');
  assert.equal(problemCopy({ kind: 'unavailable', reason: 'storefront_disabled', store }, { method: 'link', codesEnabled: true }).title, 'Acme Mart is not taking orders in the app yet');
  assert.equal(problemCopy({ kind: 'unavailable', reason: 'not_listed' }, { method: 'link', codesEnabled: true }).title, 'This shop is not available in the app');
});

test('a very long thing that was typed is shortened in the sentence', () => {
  const copy = problemCopy({ kind: 'not_found' }, { method: 'name', input: 'x'.repeat(200), codesEnabled: true });
  assert.ok(copy.body.length < 120, copy.body);
  assert.match(copy.body, /…"/);
});

test('the camera-off sentence matches what the person can do next', () => {
  assert.equal(cameraOffText(true), 'The camera is off. Type the code instead.');
  assert.equal(cameraOffText(false), 'The camera is off. Search for the shop by name instead.');
  assert.equal(cameraOffText(false, false), 'The camera is off. Turn it on in Settings to scan the QR code.');
  assert.equal(cameraOffText(true, false), 'The camera is off. Type the code instead.');
});

test('a QR code that finds nothing is called a QR code, so the title never mentions a shop code that is off', () => {
  assert.equal(problemCopy({ kind: 'not_found' }, { method: 'scan', codesEnabled: false }).title, 'No shop found for that QR code');
  assert.equal(problemCopy({ kind: 'not_found' }, { method: 'scan', codesEnabled: true }).title, 'No shop found for that QR code');
});

test('with the directory off, nobody is told to search and no search is offered', () => {
  for (const codesEnabled of [true, false]) {
    for (const method of METHODS) {
      for (const problem of PROBLEMS) {
        const copy = problemCopy(problem, { method, input: 'x', codesEnabled, directoryEnabled: false });
        assert.doesNotMatch(`${copy.title} ${copy.body}`, /search|by name/i, `${method} ${problem.kind}`);
        assert.equal(copy.actions.includes('search'), false, `${method} ${problem.kind}`);
        assert.match(copy.body, /\.$/, `${method} ${problem.kind} body ends the sentence`);
      }
    }
  }
  const scan = problemCopy({ kind: 'not_found' }, { method: 'scan', codesEnabled: false, directoryEnabled: false });
  assert.equal(scan.body, 'Try scanning the QR code at the till again.');
  assert.deepEqual(scan.actions, ['scan_again']);
  assert.deepEqual(problemCopy({ kind: 'not_a_shop' }, { method: 'scan', codesEnabled: false, directoryEnabled: false }).actions, ['scan_again']);
  assert.deepEqual(problemCopy({ kind: 'not_found' }, { method: 'link', codesEnabled: false, directoryEnabled: false }).actions, []);
});

test('with the directory on, which is the default, search is still offered', () => {
  assert.deepEqual(problemCopy({ kind: 'not_found' }, { method: 'scan', codesEnabled: false }).actions, ['scan_again', 'search']);
  assert.deepEqual(problemCopy({ kind: 'not_found' }, { method: 'scan', codesEnabled: false, directoryEnabled: true }).actions, ['scan_again', 'search']);
  assert.match(problemCopy({ kind: 'not_found' }, { method: 'link', codesEnabled: false }).body, /Search for the shop by name instead/);
});

test('a remembered shop the server no longer knows can be removed from the phone, not silently dropped', () => {
  const copy = problemCopy({ kind: 'not_found' }, { method: 'recent', codesEnabled: true });
  assert.equal(copy.title, 'This shop is no longer listed');
  assert.deepEqual(copy.actions, ['forget']);
  assert.deepEqual(problemCopy({ kind: 'not_found' }, { method: 'recent', codesEnabled: false }).actions, ['forget']);
});
