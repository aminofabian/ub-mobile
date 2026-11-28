import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { mustOpenShift, refusedForShift } from '../src/lib/shift-gate';

test('a shop that runs without shifts never asks for one', () => {
  assert.equal(mustOpenShift(true, 'missing'), false);
  assert.equal(mustOpenShift(true, 'open'), false);
  assert.equal(mustOpenShift(true, 'unknown'), false);
});

test('a shift is opened only when the shop said there is none', () => {
  assert.equal(mustOpenShift(false, 'missing'), true);
  // A check that got no answer is not a reason to hold a sale up.
  assert.equal(mustOpenShift(false, 'unknown'), false);
  assert.equal(mustOpenShift(false, 'open'), false);
});

test('the structured setup_required answer is read as a shift', () => {
  const refusal = new ApiError('Setup required', {
    status: 409,
    code: 'setup_required',
    requirement: 'shift',
  } as never);
  assert.equal(refusedForShift(refusal), true);
});

test('a plain refusal that says "no open shift" is read as a shift too', () => {
  assert.equal(refusedForShift(new ApiError('No open shift for this branch', { status: 400 })), true);
  assert.equal(refusedForShift(new ApiError('Shift is not open', { status: 409 })), true);
  assert.equal(refusedForShift(new Error('Open a shift before selling')), true);
});

test('anything else is left alone, so a real problem is not hidden behind a shift', () => {
  assert.equal(refusedForShift(new ApiError('Item not found', { status: 404 })), false);
  assert.equal(refusedForShift(new ApiError('The price is below cost', { status: 422 })), false);
  assert.equal(refusedForShift(new Error('Network request failed')), false);
  assert.equal(refusedForShift(null), false);
  assert.equal(refusedForShift(undefined), false);
  // A different setup step is not a shift.
  assert.equal(
    refusedForShift(new ApiError('Setup required', { status: 409, code: 'setup_required', requirement: 'branch' } as never)),
    false
  );
});
