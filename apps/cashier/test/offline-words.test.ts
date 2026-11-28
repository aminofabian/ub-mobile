import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import {
  COPY_NOT_MADE,
  describeNotSent,
  NOT_SENT_NO_ANSWER,
  OFFLINE_NEEDS_CONNECTION,
  OFFLINE_NO_CREDIT,
  OFFLINE_NO_PROMPT,
  OFFLINE_NOTE,
  OFFLINE_PILL,
  retryWords,
  TYPED_CODE_NOTE,
  SHIFT_UNKNOWN_OFFLINE,
  STILL_OFFLINE,
  TRY_AGAIN,
  UNSENT_OFFLINE_NOTE,
} from '../src/lib/offline-words';
import { NotAnsweredInTime } from '../src/lib/reach';

test('every word the till says offline is said, and the pill is short enough to share the header', () => {
  for (const words of [
    OFFLINE_PILL,
    OFFLINE_NOTE,
    OFFLINE_NEEDS_CONNECTION,
    OFFLINE_NO_PROMPT,
    OFFLINE_NO_CREDIT,
    TYPED_CODE_NOTE,
    TRY_AGAIN,
    STILL_OFFLINE,
    SHIFT_UNKNOWN_OFFLINE,
    UNSENT_OFFLINE_NOTE,
    NOT_SENT_NO_ANSWER,
    COPY_NOT_MADE,
  ]) {
    assert.ok(words.trim().length > 0);
    assert.equal(words, words.trim());
  }
  assert.ok(OFFLINE_PILL.length <= 10);
});

test('the words that tell a person what to do say it without blaming a sale', () => {
  assert.match(OFFLINE_NO_PROMPT, /type the code/i);
  assert.match(OFFLINE_NO_CREDIT, /cash or M-Pesa/);
  assert.match(OFFLINE_NO_CREDIT, /credit limit/, 'says why credit has to wait, for a customer chosen or not');
  assert.match(TYPED_CODE_NOTE, /does not check a typed code/);
  assert.match(TYPED_CODE_NOTE, /code and the amount must match/);
  assert.match(OFFLINE_NOTE, /saved on this phone/);
  assert.match(UNSENT_OFFLINE_NOTE, /safe on this phone/);
  assert.match(COPY_NOT_MADE, /still on this phone/);
});

test('trying all again says how many, in the singular and the plural', () => {
  assert.equal(retryWords(0), 'No sale needed trying again.');
  assert.equal(retryWords(-1), 'No sale needed trying again.');
  assert.equal(retryWords(1), '1 sale will be tried again within half a minute.');
  assert.equal(retryWords(5), '5 sales will be tried again within half a minute.');
});

test('a sale that could not be sent says why in the till\'s words when nobody answered', () => {
  assert.equal(describeNotSent(new TypeError('Network request failed')), NOT_SENT_NO_ANSWER);
  assert.equal(describeNotSent(new NotAnsweredInTime()), NOT_SENT_NO_ANSWER);
  assert.equal(describeNotSent(new ApiError('Gateway', { status: 502 })), NOT_SENT_NO_ANSWER);
  assert.equal(describeNotSent(new ApiError('<html>Wi-Fi login</html>', { status: 200, foreign: true })), NOT_SENT_NO_ANSWER);
});

test('a sale the server answered about says what the server said, cleaned, or a plain fallback', () => {
  assert.equal(describeNotSent(new ApiError('  Item  not\nfound ', { status: 404 })), 'Item not found');
  assert.equal(describeNotSent(new ApiError('', { status: 422 })), 'The server did not accept it.');
  assert.equal(describeNotSent('boom'), NOT_SENT_NO_ANSWER, 'something that is not even an error is not an answer');
});
