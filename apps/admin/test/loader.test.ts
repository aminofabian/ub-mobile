import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '@kiosk/core';
import { createLoader } from '../src/lib/loader';
import type { Loaded } from '../src/lib/loaded';

/** A read the test finishes by hand, so the order in which answers come back is the test's to choose. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function watch<T>() {
  const seen: Loaded<T>[] = [];
  return { seen, publish: (state: Loaded<T>) => void seen.push(state), last: () => seen[seen.length - 1] };
}

test('a good read is published as an answer that is not old', async () => {
  const w = watch<number>();
  const loader = createLoader(async () => 7, w.publish);
  await loader.reload();
  assert.deepEqual(w.seen, [{ state: 'ok', value: 7, stale: false }]);
});

test('the newest read wins, even when an older one comes back after it', async () => {
  const first = deferred<number | null>();
  const second = deferred<number | null>();
  const reads = [first, second];
  const w = watch<number>();
  const loader = createLoader(() => reads.shift()!.promise, w.publish);
  const a = loader.reload();
  const b = loader.reload();
  second.resolve(2);
  await b;
  first.resolve(1);
  await a;
  assert.deepEqual(w.seen, [{ state: 'ok', value: 2, stale: false }]);
});

test('a read that fails keeps the last answer and marks it old, and with no answer before it says it failed', async () => {
  const w = watch<number>();
  let next: () => Promise<number | null> = async () => 5;
  const loader = createLoader(() => next(), w.publish);
  await loader.reload();
  next = async () => {
    throw new Error('offline');
  };
  await loader.reload();
  assert.deepEqual(w.last(), { state: 'ok', value: 5, stale: true });
  next = async () => 6;
  await loader.reload();
  assert.deepEqual(w.last(), { state: 'ok', value: 6, stale: false });

  const none = watch<number>();
  const cold = createLoader<number>(async () => {
    throw new Error('offline');
  }, none.publish);
  await cold.reload();
  assert.equal(none.last()?.state, 'failed');
});

test('an answer that is not what was asked for is a failure, never an empty answer, and it does not wipe the last good one', async () => {
  const w = watch<number>();
  const loader = createLoader<number>(async () => null, w.publish);
  await loader.reload();
  assert.equal(w.last()?.state, 'failed');

  const held = watch<number>();
  let next: () => Promise<number | null> = async () => 5;
  const warm = createLoader(() => next(), held.publish);
  await warm.reload();
  next = async () => null;
  await warm.reload();
  assert.deepEqual(held.last(), { state: 'ok', value: 5, stale: true });
});

test('a role that is not allowed is told so, and nothing is held over', async () => {
  const w = watch<number>();
  const loader = createLoader<number>(async () => {
    throw new ApiError('no', { status: 403 });
  }, w.publish);
  await loader.reload();
  assert.equal(w.last()?.state, 'denied');
});

test('what was held is dropped when it belongs to something else, and a read still on its way for the old thing is ignored', async () => {
  const slow = deferred<string | null>();
  const w = watch<string>();
  let current: () => Promise<string | null> = async () => 'oranges';
  const loader = createLoader(() => current(), w.publish);
  await loader.reload();
  assert.deepEqual(w.last(), { state: 'ok', value: 'oranges', stale: false });

  current = () => slow.promise;
  const old = loader.reload();
  loader.reset();
  assert.deepEqual(w.last(), { state: 'loading' });
  slow.resolve('apples (the old search)');
  await old;
  assert.deepEqual(w.last(), { state: 'loading' }, 'the late answer for the old thing is not shown');

  current = async () => {
    throw new Error('offline');
  };
  await loader.reload();
  assert.equal(w.last()?.state, 'failed', 'the old answer is not held over as if it were this one');
});

test('nothing is published once the screen is gone, and it can be switched on again', async () => {
  const slow = deferred<number | null>();
  const w = watch<number>();
  let reads = 0;
  let next: () => Promise<number | null> = () => {
    reads += 1;
    return slow.promise;
  };
  const loader = createLoader(() => next(), w.publish);
  const pending = loader.reload();
  loader.stop();
  slow.resolve(1);
  await pending;
  await loader.reload();
  loader.reset();
  assert.deepEqual(w.seen, []);
  assert.equal(reads, 1, 'a screen that is gone asks the server for nothing more');

  loader.start();
  next = async () => 3;
  await loader.reload();
  assert.deepEqual(w.seen, [{ state: 'ok', value: 3, stale: false }]);
});

test('a part that is switched off is not read and says nothing', async () => {
  const w = watch<number>();
  let reads = 0;
  let on = false;
  const loader = createLoader(
    async () => {
      reads += 1;
      return 1;
    },
    w.publish,
    () => on
  );
  await loader.reload();
  assert.equal(reads, 0);
  assert.deepEqual(w.seen, []);
  on = true;
  await loader.reload();
  assert.equal(reads, 1);
  assert.equal(w.seen.length, 1);
});

test('reload settles whatever the read did, so a caller that waits for it is never left hanging or thrown at', async () => {
  const loader = createLoader<number>(async () => {
    throw new Error('boom');
  }, () => undefined);
  await assert.doesNotReject(loader.reload());
});
