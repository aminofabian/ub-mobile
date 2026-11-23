import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, isApiError, readApiError } from '../src/problem';

test('an answer that is a web page, or nothing, is marked as not the app\'s own', async () => {
  const page = await readApiError(new Response('<html><body><h1>403 Forbidden</h1></body></html>', { status: 403 }));
  assert.equal(isApiError(page), true);
  assert.equal(page.status, 403);
  assert.equal(page.foreign, true);
  const empty = await readApiError(new Response('', { status: 404 }));
  assert.equal(empty.status, 404);
  assert.equal(empty.foreign, true);
  const words = await readApiError(new Response('error code: 1020', { status: 403 }));
  assert.equal(words.foreign, true);
});

test('an answer the app wrote is not marked, and neither is an error made by hand', async () => {
  const problem = await readApiError(
    new Response(JSON.stringify({ title: 'Out of stock', detail: 'Milk', status: 400 }), { status: 400 })
  );
  assert.equal(problem.status, 400);
  assert.equal(problem.foreign, undefined);
  const spring = await readApiError(new Response(JSON.stringify({ message: 'Forbidden', status: 403 }), { status: 403 }));
  assert.equal(spring.foreign, undefined);
  assert.equal(new ApiError('x', { status: 400 }).foreign, undefined);
  assert.equal(new ApiError('x', { status: 400, foreign: false }).foreign, undefined);
});
