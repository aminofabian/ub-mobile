import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { classifyReplayFailure, REFUSED } from '../src/replay-failure';

const server = (status: number, message = 'whatever the server said') => new ApiError(message, { status });
const setup = (status: number, requirement: string) =>
  new ApiError('Open a shift first', { status, code: 'setup_required', requirement });

test('no answer at all is a wait: nothing is wrong with the sale', () => {
  assert.equal(classifyReplayFailure(new TypeError('Network request failed')), 'wait');
  assert.equal(classifyReplayFailure(new Error('timed out')), 'wait');
  assert.equal(classifyReplayFailure('boom'), 'wait');
  assert.equal(classifyReplayFailure(undefined), 'wait');
});

test('a server that cannot take the sale just now is a wait, not a failure', () => {
  for (const status of [401, 408, 423, 429]) {
    assert.equal(classifyReplayFailure(server(status)), 'wait', String(status));
  }
});

test('a step that has to be done first is a setup wait, whatever status carries it', () => {
  for (const status of [400, 403, 409, 412, 423]) {
    for (const requirement of ['shift', 'till', 'branch', 'dispensing']) {
      assert.equal(classifyReplayFailure(setup(status, requirement)), 'setup', `${status} ${requirement}`);
    }
  }
});

test('a server error counts as an attempt', () => {
  for (const status of [500, 501, 505, 507, 599]) {
    assert.equal(classifyReplayFailure(server(status)), 'broken', String(status));
  }
});

test('a gateway with nothing behind it is a wait, not an attempt: that is what a deploy looks like from outside', () => {
  for (const status of [502, 503, 504, 520, 521, 522, 523, 524]) {
    assert.equal(classifyReplayFailure(server(status)), 'wait', String(status));
  }
  assert.equal(classifyReplayFailure(server(519)), 'broken');
  assert.equal(classifyReplayFailure(server(525)), 'broken');
});

test('a 4xx that is not the app\'s own answer is an attempt, not a refusal: a block can lift, and a person hears if it does not', () => {
  const foreign = (status: number) => new ApiError('<html>Blocked</html>', { status, foreign: true });
  for (const status of [400, 403, 404, 407, 413, 422]) {
    assert.equal(classifyReplayFailure(foreign(status)), 'broken', String(status));
    assert.equal(classifyReplayFailure(server(status)), 'refused', `${status} written by the app`);
  }
  // The statuses that already mean "wait" or "conflict" keep meaning that, whoever sent them.
  for (const status of [401, 408, 423, 429]) assert.equal(classifyReplayFailure(foreign(status)), 'wait', String(status));
  assert.equal(classifyReplayFailure(foreign(409)), 'conflict');
});

test('a 409 is a conflict, and the words of the message do not matter', () => {
  assert.equal(classifyReplayFailure(server(409, 'Shift closed before sale completed')), 'conflict');
  assert.equal(classifyReplayFailure(server(409, '')), 'conflict');
});

test('a message that says conflict or 409 does not make a failure one', () => {
  assert.equal(classifyReplayFailure(server(500, 'conflict')), 'broken');
  assert.equal(classifyReplayFailure(server(500, 'API error: 409 Conflict')), 'broken');
  assert.equal(classifyReplayFailure(server(400, 'Item "Conflict Spray 409" is out of stock')), 'refused');
});

test('any other refusal is a refusal: the server understood and said no', () => {
  for (const status of [400, 403, 404, 410, 422]) {
    assert.equal(classifyReplayFailure(server(status)), 'refused', String(status));
  }
});

test('the marker for a refused sale is its own word', () => {
  assert.equal(REFUSED, 'refused');
});
