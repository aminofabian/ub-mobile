import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterModalCloses, IOS_MODAL_CLOSE_MS } from '../src/lib/modal-handoff';

test('on iOS the next modal waits for the last one to finish closing', () => {
  const scheduled: Array<{ task: () => void; ms: number }> = [];
  let ran = 0;
  afterModalCloses(() => (ran += 1), 'ios', (task, ms) => scheduled.push({ task, ms }));
  assert.equal(ran, 0, 'not at once');
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]?.ms, IOS_MODAL_CLOSE_MS);
  assert.ok(IOS_MODAL_CLOSE_MS >= 400, 'longer than the close animation');
  scheduled[0]?.task();
  assert.equal(ran, 1);
});

test('everywhere else it goes ahead at once', () => {
  for (const os of ['android', 'web', 'windows', '']) {
    let ran = 0;
    afterModalCloses(
      () => (ran += 1),
      os,
      () => assert.fail('nothing is scheduled'),
    );
    assert.equal(ran, 1, os);
  }
});
