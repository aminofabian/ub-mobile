import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../src/lib/with-timeout';

class Late extends Error {}

test('an answer in time is the answer', async () => {
  assert.equal(await withTimeout(async () => 7, 50, () => new Late()), 7);
});

test('a failure in time is the failure', async () => {
  const failure = new Error('boom');
  await assert.rejects(withTimeout(async () => { throw failure; }, 50, () => new Late()), (error) => error === failure);
});

test('work that throws before it starts is a failure, not a hang', async () => {
  const failure = new Error('sync boom');
  await assert.rejects(
    withTimeout(() => { throw failure; }, 50, () => new Late()),
    (error) => error === failure
  );
});

test('work that takes too long is given up on with the error asked for', async () => {
  await assert.rejects(withTimeout(() => new Promise<number>(() => undefined), 15, () => new Late()), Late);
});

test('what the work does after the time is up is ignored, without an unhandled rejection', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    let fail: (error: Error) => void = () => undefined;
    let answer: (value: number) => void = () => undefined;
    await assert.rejects(withTimeout(() => new Promise<number>((_resolve, reject) => (fail = reject)), 10, () => new Late()), Late);
    fail(new Error('too late'));
    await assert.rejects(withTimeout(() => new Promise<number>((resolve) => (answer = resolve)), 10, () => new Late()), Late);
    answer(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
