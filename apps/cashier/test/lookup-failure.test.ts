import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { describeLookupFailure } from '../src/lib/lookup-failure';

test('a till that is not allowed to look customers up says so, and does not blame the connection', () => {
  const notice = describeLookupFailure(new ApiError('Forbidden', { status: 403 }));
  assert.match(notice.title, /cannot look customers up/);
  assert.match(notice.body, /not allowed/);
  assert.doesNotMatch(notice.body, /connection/);
});

test('anything else asks for the connection to be checked', () => {
  for (const error of [new TypeError('Network request failed'), new ApiError('x', { status: 500 }), new ApiError('x', { status: 404 }), new ApiError('x', { status: 401 }), 'boom', undefined]) {
    const notice = describeLookupFailure(error);
    assert.equal(notice.title, "Couldn't look them up");
    assert.match(notice.body, /Check the connection/);
  }
});
