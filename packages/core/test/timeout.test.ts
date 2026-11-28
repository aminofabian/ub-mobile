import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TimeoutError, withTimeout } from '../src/timeout';

test('an answer in time comes through, and so does a failure', async () => {
  assert.equal(await withTimeout(Promise.resolve(5), 1000), 5);
  await assert.rejects(withTimeout(Promise.reject(new Error('boom')), 1000), /boom/);
});

test('no answer in time ends the wait with a timeout, which is not an API error', async () => {
  const never = new Promise<number>(() => undefined);
  await assert.rejects(withTimeout(never, 20), (error: unknown) => error instanceof TimeoutError && error.ms === 20 && error.name === 'TimeoutError');
});

test('an answer that comes after the wait ended changes nothing', async () => {
  let late: (value: number) => void = () => undefined;
  const slow = new Promise<number>((resolve) => {
    late = resolve;
  });
  await assert.rejects(withTimeout(slow, 10), TimeoutError);
  late(7);
  await Promise.resolve();
});
