import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCameraAccess } from '../src/camera-copy';

test('while the camera opens it says so', () => {
  assert.equal(describeCameraAccess({ kind: 'checking' }), 'Opening the camera...');
});

test('a refusal the phone will ask about again says how to be asked, and that typing works', () => {
  const words = describeCameraAccess({ kind: 'refused', canAskAgain: true });
  assert.match(words, /wasn't allowed/);
  assert.match(words, /type the code/i);
  assert.match(words, /tap Scan QR code again/);
  assert.match(words, /asked once more/);
  assert.equal(/settings/i.test(words), false, 'settings are not the way yet');
});

test('a refusal the phone will not ask about again sends the person to settings, and never promises a question', () => {
  const words = describeCameraAccess({ kind: 'refused', canAskAgain: false });
  assert.match(words, /turned off/);
  assert.match(words, /settings/i);
  assert.match(words, /type the code/i);
  assert.equal(/asked|again/i.test(words), false, 'no question is coming');
});

test('the two refusals do not say the same thing', () => {
  assert.notEqual(describeCameraAccess({ kind: 'refused', canAskAgain: true }), describeCameraAccess({ kind: 'refused', canAskAgain: false }));
});

test('a phone with no camera module says so, and that typing works', () => {
  const words = describeCameraAccess({ kind: 'missing' });
  assert.match(words, /isn't available/);
  assert.match(words, /type the code/i);
});
