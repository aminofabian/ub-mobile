import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { __answerWith, __asked } from '../../../packages/core/test/support/fakes/react-native.mjs';
import { confirmExport, EXPORT_QUESTION, EXPORT_WARNING } from '../src/lib/confirm-export';

beforeEach(() => {
  __asked.length = 0;
});

test('the copy is made only when the person says "Share"', async () => {
  __answerWith(() => 'Share');
  assert.equal(await confirmExport(), true);
  __answerWith(() => 'Cancel');
  assert.equal(await confirmExport(), false);
  __answerWith(() => 'dismiss');
  assert.equal(await confirmExport(), false, 'backing out is "no"');
});

test('the question says what is in the copy and who it is for', async () => {
  __answerWith(() => 'Cancel');
  await confirmExport();
  assert.equal(__asked.length, 1);
  assert.equal(__asked[0].title, EXPORT_QUESTION);
  assert.equal(__asked[0].message, EXPORT_WARNING);
  assert.deepEqual(__asked[0].buttons, ['Cancel', 'Share']);
  assert.match(EXPORT_WARNING, /what was sold/);
  assert.match(EXPORT_WARNING, /how it was paid/);
  assert.match(EXPORT_WARNING, /M-Pesa/);
  assert.match(EXPORT_WARNING, /full M-Pesa codes/);
  assert.match(EXPORT_WARNING, /customers the sales are for/);
  assert.match(EXPORT_WARNING, /key each sale is sent under/);
  assert.match(EXPORT_WARNING, /only with your manager or Kiosk support/i);
});
