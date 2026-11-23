import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../src/lib/with-timeout';

const later = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

test('work that finishes in time gives its own answer', async () => {
  assert.equal(await withTimeout(later(5, 'done'), 200, 'late'), 'done');
});

test('work that is too slow gives the fallback, and its late answer is not used', async () => {
  const started = Date.now();
  assert.equal(await withTimeout(later(300, 'done'), 20, 'late'), 'late');
  assert.ok(Date.now() - started < 200, 'the caller did not wait for the work');
});

test('work that never ends cannot hold the caller', async () => {
  assert.equal(await withTimeout(new Promise<string>(() => undefined), 20, 'gave up'), 'gave up');
});

test('work that fails in time fails the caller, and work that fails late is swallowed', async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error('down')), 200, 'late'), /down/);
  const failsLate = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('too late')), 60));
  assert.equal(await withTimeout(failsLate, 10, 'gave up'), 'gave up');
  await later(100, null); // the late failure happens now and must not become an unhandled rejection
});

/** Watches the timers the code under test starts, by their delay, and which of them were cleared. */
function watchTimers(delay: number) {
  const realSet = globalThis.setTimeout;
  const realClear = globalThis.clearTimeout;
  const pending = new Set<unknown>();
  globalThis.setTimeout = ((handler: () => void, ms?: number, ...rest: unknown[]) => {
    const id = (realSet as (...args: unknown[]) => unknown)(handler, ms, ...rest);
    if (ms === delay) pending.add(id);
    return id;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((id: unknown) => {
    pending.delete(id);
    return (realClear as (id: unknown) => void)(id);
  }) as typeof clearTimeout;
  return {
    pending,
    stop() {
      globalThis.setTimeout = realSet;
      globalThis.clearTimeout = realClear;
      for (const id of pending) realClear(id as never);
    },
  };
}

test('the timer is cleared once the work is done, so nothing is left running', async () => {
  const watch = watchTimers(5000);
  try {
    assert.equal(await withTimeout(later(1, 'x'), 5000, 'late'), 'x');
    assert.equal(watch.pending.size, 0, 'the timer of work that finished is gone');
    await assert.rejects(withTimeout(Promise.reject(new Error('down')), 5000, 'late'), /down/);
    assert.equal(watch.pending.size, 0, 'and the timer of work that failed');
  } finally {
    watch.stop();
  }
});

test('the watch itself sees a timer that is left running', async () => {
  const watch = watchTimers(5000);
  try {
    const waiting = withTimeout(new Promise<string>(() => undefined), 5000, 'late');
    assert.equal(watch.pending.size, 1, 'work that has not finished still has its timer');
    void waiting;
  } finally {
    watch.stop();
  }
});
