import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_REACH } from '../src/lib/reach';
import { reachSink, useReach } from '../src/store/reach-store';

const realNow = Date.now;
let clock = 1_000_000;

beforeEach(() => {
  clock = 1_000_000;
  Date.now = () => clock;
  useReach.setState({ ...FIRST_REACH });
});

afterEach(() => {
  Date.now = realNow;
});

test('the till starts out believing the line is up', () => {
  assert.equal(useReach.getState().offline, false);
});

test('a call with no answer makes the till believe it is offline, from that moment', () => {
  reachSink.lost();
  assert.equal(useReach.getState().offline, true);
  assert.equal(useReach.getState().lostAt, 1_000_000);
});

test('another failure does not move the time the line was lost', () => {
  reachSink.lost();
  clock += 30_000;
  reachSink.lost();
  assert.equal(useReach.getState().lostAt, 1_000_000);
});

test('an answer from the server ends it', () => {
  reachSink.lost();
  clock += 5_000;
  reachSink.heard();
  const state = useReach.getState();
  assert.equal(state.offline, false);
  assert.equal(state.lostAt, null);
  assert.equal(state.heardAt, 1_005_000);
});

test('a burst of answers is told once: a screen watching it is not drawn again for each call', () => {
  let changes = 0;
  const stop = useReach.subscribe(() => {
    changes += 1;
  });
  reachSink.heard();
  clock += 100;
  reachSink.heard();
  clock += 100;
  reachSink.heard();
  assert.equal(changes, 1, 'only the first answer of the burst was told');
  assert.equal(useReach.getState().heardAt, 1_000_000);
  // A second later it is told again, so the time of the last answer does not go stale.
  clock += 1_000;
  reachSink.heard();
  assert.equal(changes, 2);
  assert.equal(useReach.getState().heardAt, 1_001_200);
  stop();
});

test('an answer is always told when the line was down, however soon after the first one', () => {
  reachSink.heard();
  clock += 200;
  reachSink.lost();
  clock += 200;
  reachSink.heard();
  assert.equal(useReach.getState().offline, false, 'the line is back at once');
});

test('the sink tells the same store the screens read', () => {
  const seen: boolean[] = [];
  const stop = useReach.subscribe((state) => seen.push(state.offline));
  reachSink.lost();
  reachSink.heard();
  assert.deepEqual(seen, [true, false]);
  stop();
});
