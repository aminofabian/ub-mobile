import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isShopsOwnAnswer,
  readableDetail,
  ShopApiError,
  shopRequest,
  type FetchLike,
  type FetchResponseLike,
} from '../src/lib/shop-http';

function reply(status: number, body: string): FetchResponseLike {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

interface Seen {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function recording(answer: () => Promise<FetchResponseLike>): { fetchImpl: FetchLike; seen: Seen[] } {
  const seen: Seen[] = [];
  return {
    seen,
    fetchImpl: async (url, init) => {
      seen.push({ url, method: init.method, headers: init.headers, body: init.body });
      return answer();
    },
  };
}

const BASE = { baseUrl: 'https://api.example.test', slug: 'acme' };

test('a call goes to the shop under its address, with only the headers it was given', async () => {
  const { fetchImpl, seen } = recording(async () => reply(200, '{"ok":true}'));
  const result = await shopRequest<{ ok: boolean }>({ ...BASE, method: 'GET', path: '/storefront', fetchImpl });
  assert.deepEqual(result, { ok: true });
  assert.equal(seen[0].url, 'https://api.example.test/api/v1/public/businesses/acme/storefront');
  assert.deepEqual(seen[0].headers, { Accept: 'application/json' });
  assert.equal(seen[0].body, undefined);
});

test('a body is sent as JSON, a signed-in shopper is identified, a guest is recognised', async () => {
  const { fetchImpl, seen } = recording(async () => reply(200, '{}'));
  await shopRequest({
    ...BASE,
    method: 'PATCH',
    path: '/carts/c1/checkout-state/contact',
    body: { firstName: 'Amina' },
    bearer: 'tok',
    guestKey: 'g-1',
    correlationId: 'corr-1',
    fetchImpl,
  });
  assert.equal(seen[0].method, 'PATCH');
  assert.equal(seen[0].body, '{"firstName":"Amina"}');
  assert.deepEqual(seen[0].headers, {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Correlation-Id': 'corr-1',
    Authorization: 'Bearer tok',
    'X-Checkout-Guest-Key': 'g-1',
  });
});

test('the shop is named safely in the address', async () => {
  const { fetchImpl, seen } = recording(async () => reply(200, '{}'));
  await shopRequest({ ...BASE, slug: 'a b/../c', method: 'GET', path: '/storefront', fetchImpl });
  assert.equal(seen[0].url, 'https://api.example.test/api/v1/public/businesses/a%20b%2F..%2Fc/storefront');
});

test('a refusal keeps the shop\'s own words, and is an answer: nothing was done', async () => {
  const body = JSON.stringify({ type: 'about:blank', title: 'Bad Request', status: 400, detail: 'We do not deliver to that area. Please choose one of the areas we serve.' });
  const { fetchImpl } = recording(async () => reply(400, body));
  await assert.rejects(
    shopRequest({ ...BASE, method: 'PATCH', path: '/x', fetchImpl }),
    (error: unknown) => {
      assert.ok(error instanceof ShopApiError);
      assert.equal(error.kind, 'http');
      assert.equal(error.status, 400);
      assert.equal(error.answered, true);
      assert.equal(error.message, 'We do not deliver to that area. Please choose one of the areas we serve.');
      return true;
    },
  );
});

test('a refusal says whether the words are the shop\'s own, which a proxy\'s or a portal\'s are not', async () => {
  const problem = JSON.stringify({ type: 'https://x/problems/validation', title: 'Validation failed', status: 400, errors: [{ field: 'firstName', message: 'size' }] });
  const own = recording(async () => reply(400, problem));
  await assert.rejects(shopRequest({ ...BASE, method: 'PATCH', path: '/x', body: {}, fetchImpl: own.fetchImpl }), (e: ShopApiError) => e.fromShop === true && e.detail === '');
  for (const [status, body] of [[429, 'Too Many Requests'], [403, '<html><body>Blocked</body></html>'], [407, ''], [400, '{"message":"Bad Request"}']] as const) {
    const other = recording(async () => reply(status, body));
    await assert.rejects(shopRequest({ ...BASE, method: 'POST', path: '/x', body: {}, fetchImpl: other.fetchImpl }), (e: ShopApiError) => e.status === status && e.fromShop === false, `${status}`);
  }
  assert.equal(new ShopApiError('http', 400, 'words').fromShop, false, 'nothing claims to be the shop\'s unless it was read as such');
});

test('an error body is the shop\'s own when it is Problem+JSON for the status it came with', () => {
  assert.equal(isShopsOwnAnswer('{"type":"about:blank","title":"Not Found","status":404,"detail":"Not found"}', 404), true);
  assert.equal(isShopsOwnAnswer('{"title":"Bad Request","status":400}', 400), true);
  assert.equal(isShopsOwnAnswer('{"title":"Bad Request","status":400}', 429), false, 'a status that is not the one it came with');
  assert.equal(isShopsOwnAnswer('{"status":400}', 400), false, 'no title');
  assert.equal(isShopsOwnAnswer('{"title":7,"status":400}', 400), false);
  assert.equal(isShopsOwnAnswer('{"message":"Too Many Requests"}', 429), false);
  assert.equal(isShopsOwnAnswer('null', 400), false);
  assert.equal(isShopsOwnAnswer('[]', 400), false);
  assert.equal(isShopsOwnAnswer('<html>Blocked</html>', 403), false);
  assert.equal(isShopsOwnAnswer('', 400), false);
});

test('a refusal with nothing readable still says what happened', async () => {
  const { fetchImpl } = recording(async () => reply(502, '<html><body>Bad gateway</body></html>'));
  await assert.rejects(shopRequest({ ...BASE, method: 'POST', path: '/x', fetchImpl }), (error: unknown) => {
    assert.ok(error instanceof ShopApiError);
    assert.equal(error.detail, '');
    assert.equal(error.status, 502);
    assert.equal(error.message, 'The shop answered with an error (502).');
    return true;
  });
});

test('what the server wrote is read from detail, then message, never from the status phrase or a web page', () => {
  assert.equal(readableDetail('{"detail":" Cart is empty ","message":"x"}'), 'Cart is empty');
  assert.equal(readableDetail('{"message":"Invalid email"}'), 'Invalid email');
  assert.equal(readableDetail('{"title":"Bad Request"}'), '');
  assert.equal(readableDetail('{"detail":42}'), '');
  assert.equal(readableDetail('Too many requests'), 'Too many requests');
  assert.equal(readableDetail('<!doctype html><html><body>oops</body></html>'), '');
  assert.equal(readableDetail(''), '');
  assert.equal(readableDetail('   '), '');
  assert.equal(readableDetail('x'.repeat(500)), '');
  assert.equal(readableDetail(JSON.stringify({ detail: 'y'.repeat(500) })).length, 240);
});

test('no connection is not an answer: the call may or may not have been carried out', async () => {
  const { fetchImpl } = recording(async () => {
    throw new TypeError('Network request failed');
  });
  await assert.rejects(shopRequest({ ...BASE, method: 'POST', path: '/x', fetchImpl }), (error: unknown) => {
    assert.ok(error instanceof ShopApiError);
    assert.equal(error.kind, 'network');
    assert.equal(error.status, null);
    assert.equal(error.answered, false);
    assert.equal(error.message, 'No connection to the shop.');
    return true;
  });
});

test('a call that is not answered in time is given up, and is not an answer either', async () => {
  const fetchImpl: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
  await assert.rejects(shopRequest({ ...BASE, method: 'POST', path: '/x', timeoutMs: 20, fetchImpl }), (error: unknown) => {
    assert.ok(error instanceof ShopApiError);
    assert.equal(error.kind, 'timeout');
    assert.equal(error.answered, false);
    assert.equal(error.message, 'The shop took too long to answer.');
    return true;
  });
});

test('a good answer that cannot be read is not an answer, for a call that changes something', async () => {
  const { fetchImpl } = recording(async () => reply(200, '{"orderId": '));
  await assert.rejects(shopRequest({ ...BASE, method: 'POST', path: '/x', fetchImpl }), (error: unknown) => {
    assert.ok(error instanceof ShopApiError);
    assert.equal(error.kind, 'unreadable');
    assert.equal(error.status, 200);
    assert.equal(error.answered, false);
    return true;
  });
});

test('an answer that stops part way is not an answer', async () => {
  const cut: FetchResponseLike = {
    ok: true,
    status: 201,
    text: async () => {
      throw new TypeError('network error');
    },
  };
  const { fetchImpl } = recording(async () => cut);
  await assert.rejects(shopRequest({ ...BASE, method: 'POST', path: '/x', fetchImpl }), (error: unknown) => {
    assert.ok(error instanceof ShopApiError);
    assert.equal(error.kind, 'unreadable');
    assert.equal(error.answered, false);
    return true;
  });
});

test('an empty good answer is nothing, not an error', async () => {
  const { fetchImpl } = recording(async () => reply(204, ''));
  assert.equal(await shopRequest({ ...BASE, method: 'DELETE', path: '/x', fetchImpl }), undefined);
});
