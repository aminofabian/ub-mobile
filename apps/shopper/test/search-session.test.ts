import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SearchResult, StoreHit } from '@kiosk/core';
import { createSearchSession, SEARCH_DELAY_MS, type SearchView } from '../src/lib/search-session';

const hit = (slug: string): StoreHit => ({ slug, name: slug.toUpperCase() });
const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Time that moves only when the test says so. */
function clock() {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    setTimer(run: () => void, ms: number) {
      const id = next++;
      timers.set(id, { at: now + ms, run });
      return id;
    },
    clearTimer(handle: unknown) {
      timers.delete(handle as number);
    },
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at <= now && timers.has(id)) {
          timers.delete(id);
          timer.run();
        }
      }
    },
    pending: () => timers.size,
  };
}

/** A server whose answers arrive when the test says so. */
function server() {
  const asked: Array<{ text: string; answer: (result: SearchResult) => void; fail: (error: Error) => void }> = [];
  return {
    asked,
    search: (text: string) =>
      new Promise<SearchResult>((resolve, reject) => {
        asked.push({ text, answer: resolve, fail: reject });
      }),
  };
}

function setup(options: { delayMs?: number } = {}) {
  const time = clock();
  const api = server();
  const views: SearchView[] = [];
  const session = createSearchSession(
    { search: api.search, clean, minLength: 2, setTimer: time.setTimer, clearTimer: time.clearTimer, ...options },
    (view) => views.push(view),
  );
  return { time, api, views, session, last: () => views[views.length - 1] };
}

const results = (query: string, ...slugs: string[]): SearchResult => ({ kind: 'results', query, hits: slugs.map(hit) });

test('one letter asks nothing and shows nothing', () => {
  const { session, api, time, views } = setup();
  session.update('a');
  time.advance(5_000);
  assert.deepEqual(views, [{ kind: 'idle' }]);
  assert.equal(api.asked.length, 0);
});

test('the server is asked once, after the person pauses, about what is in the box then', async () => {
  const { session, api, time, views } = setup();
  session.update('fr');
  session.update('fre');
  session.update('fres');
  time.advance(SEARCH_DELAY_MS - 1);
  assert.equal(api.asked.length, 0, 'still typing');
  time.advance(1);
  assert.deepEqual(api.asked.map((call) => call.text), ['fres']);
  api.asked[0]!.answer(results('fres', 'fresh-mart'));
  await flush();
  assert.deepEqual(views.at(-1), { kind: 'results', text: 'fres', hits: [hit('fresh-mart')] });
});

test('typing a space or deleting one is not a new question', () => {
  const { session, time, views, api } = setup();
  session.update('fresh');
  const emitted = views.length;
  session.update('fresh ');
  session.update(' fresh');
  assert.equal(views.length, emitted, 'no new view');
  time.advance(SEARCH_DELAY_MS);
  assert.equal(api.asked.length, 1);
});

test('a slow answer to an old question never replaces the answer to the latest one', async () => {
  const { session, api, time, views } = setup();
  session.update('fre');
  time.advance(SEARCH_DELAY_MS);
  session.update('fresh');
  time.advance(SEARCH_DELAY_MS);
  assert.deepEqual(api.asked.map((call) => call.text), ['fre', 'fresh']);

  api.asked[1]!.answer(results('fresh', 'fresh-mart'));
  await flush();
  const shown = views.at(-1);
  assert.deepEqual(shown, { kind: 'results', text: 'fresh', hits: [hit('fresh-mart')] });

  const before = views.length;
  api.asked[0]!.answer(results('fre', 'freezer-world', 'fred-shop'));
  await flush();
  assert.equal(views.length, before, 'the old answer changed nothing');
});

test('an answer that arrives after the box was emptied is dropped', async () => {
  const { session, api, time, views } = setup();
  session.update('fresh');
  time.advance(SEARCH_DELAY_MS);
  session.update('');
  assert.deepEqual(views.at(-1), { kind: 'idle' });
  api.asked[0]!.answer(results('fresh', 'fresh-mart'));
  await flush();
  assert.deepEqual(views.at(-1), { kind: 'idle' });
});

test('an answer that arrives while the person is typing more is dropped too', async () => {
  const { session, api, time, views } = setup();
  session.update('fresh');
  time.advance(SEARCH_DELAY_MS);
  session.update('fresh m');
  api.asked[0]!.answer(results('fresh', 'fresh-mart'));
  await flush();
  assert.equal(views.at(-1)?.kind, 'searching');
  assert.equal((views.at(-1) as { text: string }).text, 'fresh m');
});

test('no match, no connection, too many tries, no directory and a crash are each their own view', async () => {
  const { session, api, time, views } = setup();
  const askAndAnswer = async (text: string, answer: SearchResult | Error) => {
    session.update(text);
    time.advance(SEARCH_DELAY_MS);
    const call = api.asked.at(-1)!;
    if (answer instanceof Error) call.fail(answer);
    else call.answer(answer);
    await flush();
    return views.at(-1);
  };
  assert.deepEqual(await askAndAnswer('zz', { kind: 'results', query: 'zz', hits: [] }), { kind: 'empty', text: 'zz' });
  assert.deepEqual(await askAndAnswer('zzz', { kind: 'offline' }), { kind: 'offline', text: 'zzz' });
  assert.deepEqual(await askAndAnswer('zzzz', { kind: 'rate_limited', retryAfterSec: 30 }), { kind: 'rate_limited', text: 'zzzz', retryAfterSec: 30 });
  assert.deepEqual(await askAndAnswer('zzzzz', { kind: 'rate_limited' }), { kind: 'rate_limited', text: 'zzzzz' });
  assert.deepEqual(await askAndAnswer('zzzzzz', { kind: 'unavailable' }), { kind: 'unavailable', text: 'zzzzzz' });
  assert.deepEqual(await askAndAnswer('zzzzzzz', new Error('boom')), { kind: 'offline', text: 'zzzzzzz' });
});

test('while the next answer is on its way the last one stays on screen', async () => {
  const { session, api, time, views } = setup();
  session.update('fresh');
  time.advance(SEARCH_DELAY_MS);
  api.asked[0]!.answer(results('fresh', 'fresh-mart'));
  await flush();
  session.update('fresh m');
  assert.deepEqual(views.at(-1), { kind: 'searching', text: 'fresh m', hits: [hit('fresh-mart')] });
});

test('clearing the box forgets the last answer', async () => {
  const { session, api, time, views } = setup();
  session.update('fresh');
  time.advance(SEARCH_DELAY_MS);
  api.asked[0]!.answer(results('fresh', 'fresh-mart'));
  await flush();
  session.update('');
  session.update('ab');
  assert.deepEqual(views.at(-1), { kind: 'searching', text: 'ab', hits: [] });
});

test('Go asks at once, and does nothing for a box that is too short', () => {
  const { session, api, time } = setup();
  session.update('a');
  session.submit();
  assert.equal(api.asked.length, 0);
  session.update('acme');
  session.submit();
  assert.deepEqual(api.asked.map((call) => call.text), ['acme']);
  assert.equal(time.pending(), 0, 'the pause was cancelled, so the same question is not asked twice');
  time.advance(10_000);
  assert.equal(api.asked.length, 1);
});

test('Try again asks the same question again, and only the new answer counts', async () => {
  const { session, api, time, views } = setup();
  session.update('acme');
  time.advance(SEARCH_DELAY_MS);
  api.asked[0]!.answer({ kind: 'offline' });
  await flush();
  assert.equal(views.at(-1)?.kind, 'offline');
  session.retry();
  assert.equal(views.at(-1)?.kind, 'searching');
  assert.deepEqual(api.asked.map((call) => call.text), ['acme', 'acme']);
  api.asked[1]!.answer(results('acme', 'acme-mart'));
  await flush();
  assert.equal(views.at(-1)?.kind, 'results');
});

test('after the screen is gone nothing is shown and no question is left waiting', async () => {
  const { session, api, time, views } = setup();
  session.update('fresh');
  session.dispose();
  assert.equal(time.pending(), 0);
  time.advance(SEARCH_DELAY_MS * 2);
  assert.equal(api.asked.length, 0);

  const second = setup();
  second.session.update('fresh');
  second.time.advance(SEARCH_DELAY_MS);
  second.session.dispose();
  const emitted = second.views.length;
  second.api.asked[0]!.answer(results('fresh', 'fresh-mart'));
  await flush();
  assert.equal(second.views.length, emitted);
  void views;
});

test('a session that is gone ignores the box, Go and Try again', () => {
  const { session, api, time, views } = setup();
  session.update('fresh');
  session.dispose();
  const emitted = views.length;
  session.update('fresh market');
  session.submit();
  session.retry();
  time.advance(SEARCH_DELAY_MS * 2);
  assert.equal(views.length, emitted);
  assert.equal(api.asked.length, 0);
  assert.equal(time.pending(), 0);
});
