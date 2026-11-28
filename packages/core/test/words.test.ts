import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCents, formatKes, readFailureWords } from '../src/words';
import { ApiError } from '../src/problem';

test('cents are shown with two decimals and grouped thousands', () => {
  assert.equal(formatCents(125050), '1,250.50');
  assert.equal(formatCents(0), '0.00');
  assert.equal(formatCents(5), '0.05');
  assert.equal(formatCents(100), '1.00');
  assert.equal(formatCents(123456789), '1,234,567.89');
  assert.equal(formatCents(99999), '999.99');
  assert.equal(formatCents(100000), '1,000.00');
});

test('a negative amount keeps its sign, and a half cent rounds away from nothing', () => {
  assert.equal(formatCents(-5), '-0.05');
  assert.equal(formatCents(-125050), '-1,250.50');
  assert.equal(formatCents(10.4), '0.10');
});

test('a figure that is not a number is a dash, never a zero', () => {
  assert.equal(formatCents(Number.NaN), '—');
  assert.equal(formatCents(Number.POSITIVE_INFINITY), '—');
});

test('money in shillings', () => {
  assert.equal(formatKes(125050), 'KES 1,250.50');
});

test('a failed read is explained by its status', () => {
  assert.match(readFailureWords(new ApiError('x', { status: 401 })), /signed out/);
  assert.match(readFailureWords(new ApiError('x', { status: 403 })), /role is not allowed/);
  assert.match(readFailureWords(new ApiError('x', { status: 404 })), /no longer there/);
  assert.match(readFailureWords(new ApiError('x', { status: 503 })), /server had a problem/);
  assert.match(readFailureWords(new ApiError('x', { status: 200, foreign: true })), /not reaching the shop/);
});

test('no answer at all is "could not reach", whatever the error was', () => {
  const words = 'Could not reach the server. Check the signal and try again.';
  assert.equal(readFailureWords(new Error('Network request failed')), words);
  assert.equal(readFailureWords(undefined), words);
  assert.equal(readFailureWords(new ApiError('x', { status: 400 })), words);
});

test('a server that answers with a failure of its own is "had a problem", from the first such status on', () => {
  assert.match(readFailureWords(new ApiError('x', { status: 500 })), /server had a problem/);
  assert.match(readFailureWords(new ApiError('x', { status: 599 })), /server had a problem/);
  assert.match(readFailureWords(new ApiError('x', { status: 499 })), /Could not reach/);
});
