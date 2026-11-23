import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshPhone, installFetch, offlineNetwork } from './support/world.mjs';
import { configureStorage } from '../src/storage';
import { cleanSearchText, searchStores } from '../src/store-directory';
import { API, searchUrl } from './fixtures';

let net: { calls: Array<{ url: string }>; restore(): void } | null = null;

beforeEach(() => {
  freshPhone({});
  configureStorage(null);
});

afterEach(() => {
  net?.restore();
  net = null;
});

function serve(routes: unknown[]) {
  net = installFetch(routes);
  return net;
}

test('what is in the search box is tidied before it is sent', () => {
  assert.equal(cleanSearchText('  green   grocers  '), 'green grocers');
  assert.equal(cleanSearchText('a\tb\nc'), 'a b c');
  assert.equal(cleanSearchText(''), '');
  assert.equal(cleanSearchText('x'.repeat(200)).length, 60);
  assert.equal(cleanSearchText('x '.repeat(100)).endsWith(' '), false);
});

test('fewer than two characters is not searched, and nothing is sent', async () => {
  const handle = serve([]);
  assert.deepEqual(await searchStores('', API), { kind: 'too_short' });
  assert.deepEqual(await searchStores(' a ', API), { kind: 'too_short' });
  assert.deepEqual(await searchStores('   ', API), { kind: 'too_short' });
  assert.equal(handle.calls.length, 0);
});

test('a name finds shops, and the rows keep only what is safe to show', async () => {
  const handle = serve([
    [
      searchUrl('green'),
      {
        status: 200,
        body: [
          { slug: 'green-grocers', name: 'Green Grocers', logoUrl: 'https://cdn.kiosk.ke/logo.png', primaryHost: 'Green-Grocers.kiosk.ke' },
          { slug: 'greenfield', name: '  Greenfield   Mart ', primaryHost: null },
          { slug: 'green-grocers', name: 'The same shop again' },
          { slug: 'Bad Slug', name: 'Not a slug' },
          { slug: 'noname', name: '   ' },
          { slug: 'nolabel' },
          { slug: 'odd-logo', name: 'Odd Logo', logoUrl: 'javascript:alert(1)', primaryHost: 'a b/c' },
          'not an object',
          null,
        ],
      },
    ],
  ]);
  const result = await searchStores('green', API);
  assert.equal(result.kind, 'results');
  if (result.kind !== 'results') return;
  assert.equal(result.query, 'green');
  assert.deepEqual(result.hits, [
    { slug: 'green-grocers', name: 'Green Grocers', logoUrl: 'https://cdn.kiosk.ke/logo.png', host: 'green-grocers.kiosk.ke' },
    { slug: 'greenfield', name: 'Greenfield Mart' },
    { slug: 'odd-logo', name: 'Odd Logo' },
  ]);
  assert.equal(handle.calls.length, 1);
});

test('the text is sent tidied and encoded, and the answer says what was sent', async () => {
  const handle = serve([[/shops\/search/, { status: 200, body: [] }]]);
  const result = await searchStores('  acme &  sons ', API);
  assert.equal(handle.calls[0]?.url, searchUrl('acme & sons'));
  assert.match(handle.calls[0]?.url ?? '', /q=acme%20%26%20sons$/);
  assert.deepEqual(result, { kind: 'results', query: 'acme & sons', hits: [] });
});

test('no more than twenty rows are kept, however many come back', async () => {
  const rows = Array.from({ length: 50 }, (_, index) => ({ slug: `shop-${index}`, name: `Shop ${index}` }));
  serve([[/shops\/search/, { status: 200, body: rows }]]);
  const result = await searchStores('shop', API);
  assert.equal(result.kind === 'results' ? result.hits.length : -1, 20);
});

test('an answer that is not a list is an empty list, not a crash', async () => {
  serve([[/shops\/search/, { status: 200, body: { error: 'surprise' } }]]);
  assert.deepEqual(await searchStores('acme', API), { kind: 'results', query: 'acme', hits: [] });
});

test('failures are told apart: no connection, server trouble, too many tries, no directory', async () => {
  serve([[/shops\/search/, () => { throw new TypeError('Network request failed'); }]]);
  assert.deepEqual(await searchStores('acme', API), { kind: 'offline' });
  net?.restore();

  serve([[/shops\/search/, { status: 503, body: {} }]]);
  assert.deepEqual(await searchStores('acme', API), { kind: 'offline' });
  net?.restore();

  serve([[/shops\/search/, { status: 200, body: [], invalidJson: true }]]);
  assert.deepEqual(await searchStores('acme', API), { kind: 'offline' });
  net?.restore();

  serve([[/shops\/search/, { status: 429, body: {}, headers: { 'Retry-After': '30' } }]]);
  assert.deepEqual(await searchStores('acme', API), { kind: 'rate_limited', retryAfterSec: 30 });
  net?.restore();

  serve([[/shops\/search/, { status: 404, body: {} }]]);
  assert.deepEqual(await searchStores('acme', API), { kind: 'unavailable' });
  net?.restore();

  // The server looked at the text and had nothing to say about it: no shops, not a fault.
  serve([[/shops\/search/, { status: 400, body: {} }]]);
  assert.deepEqual(await searchStores('acme', API), { kind: 'results', query: 'acme', hits: [] });
});

test('with the network down a search answers offline and never throws', async () => {
  net = offlineNetwork();
  assert.deepEqual(await searchStores('acme', API), { kind: 'offline' });
});

test('a logo must be a secure address, and a name carries nothing that hides or reorders text', async () => {
  serve([
    [
      searchUrl('acme'),
      {
        status: 200,
        body: [
          { slug: 'plain', name: 'Plain', logoUrl: 'http://cdn.example.com/logo.png' },
          { slug: 'secure', name: 'Sec\u200Bure \u202Eevil', logoUrl: ' https://cdn.example.com/logo.png ' },
        ],
      },
    ],
  ]);
  const result = await searchStores('acme', API);
  assert.equal(result.kind, 'results');
  if (result.kind !== 'results') return;
  assert.deepEqual(result.hits, [
    { slug: 'plain', name: 'Plain' },
    { slug: 'secure', name: 'Secure evil', logoUrl: 'https://cdn.example.com/logo.png' },
  ]);
});

test('text cut to length never leaves half an emoji, which a web address cannot hold', () => {
  const cleaned = cleanSearchText('a'.repeat(59) + '😀' + 'tail');
  assert.equal(Array.from(cleaned).length, 60);
  assert.ok(cleaned.endsWith('😀'));
  assert.doesNotThrow(() => encodeURIComponent(cleaned));
});
