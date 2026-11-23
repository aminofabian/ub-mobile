import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_REFRESH_MS, PLATFORM_RETRY_MS, shouldAskPlatformAgain } from '../src/lib/platform-refresh';

const T0 = 1_000_000;

test('an answer is trusted for half an hour, and then the next return to the app asks again', () => {
  assert.equal(shouldAskPlatformAgain({ now: T0 + 1_000, lastAskedAt: T0, haveAnswer: true }), false);
  assert.equal(shouldAskPlatformAgain({ now: T0 + PLATFORM_REFRESH_MS - 1, lastAskedAt: T0, haveAnswer: true }), false);
  assert.equal(shouldAskPlatformAgain({ now: T0 + PLATFORM_REFRESH_MS, lastAskedAt: T0, haveAnswer: true }), true);
});

test('with no answer yet it tries again sooner, but never in a burst', () => {
  assert.equal(shouldAskPlatformAgain({ now: T0 + 5_000, lastAskedAt: T0, haveAnswer: false }), false);
  assert.equal(shouldAskPlatformAgain({ now: T0 + PLATFORM_RETRY_MS - 1, lastAskedAt: T0, haveAnswer: false }), false);
  assert.equal(shouldAskPlatformAgain({ now: T0 + PLATFORM_RETRY_MS, lastAskedAt: T0, haveAnswer: false }), true);
  assert.ok(PLATFORM_RETRY_MS < PLATFORM_REFRESH_MS);
});

test('an app that has never asked, asks (a clock reads in the billions, so zero is long ago)', () => {
  const now = 1_700_000_000_000;
  assert.equal(shouldAskPlatformAgain({ now, lastAskedAt: 0, haveAnswer: false }), true);
  assert.equal(shouldAskPlatformAgain({ now, lastAskedAt: 0, haveAnswer: true }), true);
});
