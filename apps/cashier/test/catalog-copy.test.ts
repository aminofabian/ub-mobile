import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import type { CartItem } from '../src/lib/cart';
import { encodeCatalog } from '../src/lib/catalog';
import {
  MAX_PAGES,
  NO_COPY,
  NothingToSell,
  PAGE_RETRY_WAITS_MS,
  PAGE_SIZE,
  PageTimedOut,
  createCatalogCopy,
  failureOf,
  readAll,
  type CatalogPage,
  type CopyDeps,
} from '../src/lib/catalog-copy';

const NOON = Date.parse('2026-11-23T12:00:00.000Z');

const item = (n: number): CartItem => ({ id: `i-${n}`, name: `Product ${n}`, sellingPrice: 10 + n });
const page = (from: number, count: number, over: Partial<CatalogPage> = {}): CatalogPage => ({
  items: Array.from({ length: count }, (_, k) => item(from + k)),
  seen: count,
  last: false,
  total: null,
  ...over,
});
const server = (status: number) => new ApiError('x', { status });
const instant = () => Promise.resolve();

/** A shop with `pages` pages of `PAGE_SIZE` products. */
function shopOf(pages: number, over: (n: number) => Partial<CatalogPage> = () => ({})) {
  const asked: number[] = [];
  const fetchPage = async (n: number, size: number): Promise<CatalogPage> => {
    asked.push(n);
    assert.equal(size, PAGE_SIZE);
    return page(n * PAGE_SIZE, PAGE_SIZE, { last: n === pages - 1, total: pages * PAGE_SIZE, ...over(n) });
  };
  return { asked, fetchPage };
}

test('every page is read, in order, and the last one ends it', async () => {
  const shop = shopOf(3);
  const progress: unknown[] = [];
  const out = await readAll({ fetchPage: shop.fetchPage, sleep: instant, onProgress: (p) => progress.push(p) });
  assert.deepEqual(shop.asked, [0, 1, 2]);
  assert.equal(out.items.length, 3 * PAGE_SIZE);
  assert.equal(out.cut, false);
  assert.deepEqual(progress, [
    { scanned: PAGE_SIZE, total: 3 * PAGE_SIZE },
    { scanned: 2 * PAGE_SIZE, total: 3 * PAGE_SIZE },
    { scanned: 3 * PAGE_SIZE, total: 3 * PAGE_SIZE },
  ]);
});

test('a product that moved onto the next page while the list was read is kept once', async () => {
  const pages = [page(0, 3, { last: false }), page(2, 3, { last: true })];
  const out = await readAll({ fetchPage: async (n) => pages[n] as CatalogPage, sleep: instant });
  assert.deepEqual(out.items.map((i) => i.id), ['i-0', 'i-1', 'i-2', 'i-3', 'i-4']);
});

test('when the server does not say which page is last, a short page is', async () => {
  const pages = [page(0, PAGE_SIZE, { last: null }), page(PAGE_SIZE, 7, { last: null })];
  const asked: number[] = [];
  const out = await readAll({
    fetchPage: async (n) => {
      asked.push(n);
      return pages[n] as CatalogPage;
    },
    sleep: instant,
  });
  assert.deepEqual(asked, [0, 1]);
  assert.equal(out.items.length, PAGE_SIZE + 7);
});

test('a full page with no word on whether it is the last is followed by another', async () => {
  const asked: number[] = [];
  const out = await readAll({
    fetchPage: async (n) => {
      asked.push(n);
      return n === 0 ? page(0, PAGE_SIZE, { last: null }) : page(PAGE_SIZE, 0, { last: null, seen: 0 });
    },
    sleep: instant,
  });
  assert.deepEqual(asked, [0, 1], 'an empty page ends it');
  assert.equal(out.items.length, PAGE_SIZE);
});

test('a page of rows that cannot be sold does not end the list', async () => {
  const asked: number[] = [];
  const out = await readAll({
    fetchPage: async (n) => {
      asked.push(n);
      if (n === 0) return { items: [], seen: PAGE_SIZE, last: false, total: null };
      return page(0, 2, { last: true });
    },
    sleep: instant,
  });
  assert.deepEqual(asked, [0, 1]);
  assert.equal(out.items.length, 2);
});

test('a shop with nothing to sell gives no copy, rather than a copy of nothing', async () => {
  await assert.rejects(readAll({ fetchPage: async () => ({ items: [], seen: 0, last: true, total: 0 }), sleep: instant }), NothingToSell);
  await assert.rejects(
    readAll({ fetchPage: async () => ({ items: [], seen: 12, last: true, total: 12 }), sleep: instant }),
    NothingToSell,
    'twelve rows, none of them sellable'
  );
});

test('a page nobody answers is asked again, after a wait, and the list carries on', async () => {
  let tries = 0;
  const waits: number[] = [];
  const out = await readAll({
    fetchPage: async (n) => {
      if (n === 0) {
        tries += 1;
        if (tries < 3) throw new TypeError('Network request failed');
      }
      return page(0, 2, { last: true });
    },
    sleep: async (ms) => {
      waits.push(ms);
    },
  });
  assert.equal(tries, 3);
  assert.deepEqual(waits, [...PAGE_RETRY_WAITS_MS]);
  assert.equal(out.items.length, 2);
});

test('a page that fails three times fails the whole read, with the last error', async () => {
  let tries = 0;
  const last = new TypeError('Network request failed (3)');
  await assert.rejects(
    readAll({
      fetchPage: async () => {
        tries += 1;
        throw tries === 3 ? last : new TypeError('earlier');
      },
      sleep: instant,
    }),
    (error) => error === last
  );
  assert.equal(tries, 3);
});

test('a server that broke is asked again; one that said no is not', async () => {
  let broke = 0;
  await assert.rejects(readAll({ fetchPage: async () => { broke += 1; throw server(500); }, sleep: instant }));
  assert.equal(broke, 3, '500: three tries');
  for (const status of [400, 401, 403, 404, 409, 422, 429]) {
    let tries = 0;
    await assert.rejects(readAll({ fetchPage: async () => { tries += 1; throw server(status); }, sleep: instant }), (e) => (e as ApiError).status === status);
    assert.equal(tries, 1, `${status}: one try`);
  }
});

test('a page that never comes is given up on, and asked again', async () => {
  let tries = 0;
  const out = await readAll({
    pageWaitMs: 5,
    fetchPage: (n) => {
      tries += 1;
      return tries < 2 ? new Promise<CatalogPage>(() => undefined) : Promise.resolve(page(n, 1, { last: true }));
    },
    sleep: instant,
  });
  assert.equal(tries, 2);
  assert.equal(out.items.length, 1);
  await assert.rejects(readAll({ pageWaitMs: 5, fetchPage: () => new Promise<CatalogPage>(() => undefined), sleep: instant }), PageTimedOut);
});

test('a list longer than the phone keeps stops being read, and says it was cut', async () => {
  let asked = 0;
  const out = await readAll({
    fetchPage: async (n) => {
      asked += 1;
      return page(n * PAGE_SIZE, PAGE_SIZE, { last: false });
    },
    sleep: instant,
  });
  assert.equal(out.cut, true);
  assert.ok(out.items.length >= 20_000 && out.items.length < 20_000 + PAGE_SIZE, String(out.items.length));
  assert.ok(asked < MAX_PAGES);
});

test('a list that never says it has ended is not read for ever', async () => {
  let asked = 0;
  const out = await readAll({
    fetchPage: async (n) => {
      asked += 1;
      return n === 0 ? page(0, 1, { seen: PAGE_SIZE, last: false }) : { items: [], seen: PAGE_SIZE, last: false, total: null };
    },
    sleep: instant,
  });
  assert.equal(asked, MAX_PAGES);
  assert.equal(out.cut, true);
  assert.equal(out.items.length, 1);
  await assert.rejects(readAll({ fetchPage: async () => ({ items: [], seen: PAGE_SIZE, last: false, total: null }), sleep: instant }), NothingToSell);
});

test('why a copy could not be made, in four kinds', () => {
  assert.equal(failureOf(new NothingToSell()), 'nothing');
  assert.equal(failureOf(new TypeError('Network request failed')), 'no_answer');
  assert.equal(failureOf(new PageTimedOut()), 'no_answer');
  assert.equal(failureOf(server(503)), 'no_answer');
  assert.equal(failureOf(server(500)), 'no_answer');
  assert.equal(failureOf(server(403)), 'refused');
  assert.equal(failureOf(server(404)), 'refused');
});

// -------------------------------------------------------------------------------------------------------------

function fakeDeps(over: Partial<CopyDeps> & { stored?: string | null } = {}) {
  const writes: string[] = [];
  let stored: string | null = over.stored ?? null;
  let clock = NOON;
  const deps: CopyDeps = {
    read: async () => stored,
    write: async (text) => {
      writes.push(text);
      stored = text;
      return true;
    },
    fetchPage: async (n) => page(n, 3, { last: true, total: 3 }),
    branchId: 'b-1',
    now: () => clock,
    sleep: instant,
    offline: () => false,
    ...over,
  };
  return { deps, writes, stored: () => stored, tick: (ms: number) => { clock += ms; } };
}

const textFor = (branchId: string, at: number, items: CartItem[]) => encodeCatalog({ branchId, at, items }).text;

test('a till that has not looked at the phone knows nothing', () => {
  const copy = createCatalogCopy(fakeDeps().deps);
  assert.deepEqual(copy.state(), NO_COPY);
  assert.equal(NO_COPY.loaded, false);
});

test('a copy on the phone for this branch is opened, and is said to be saved', async () => {
  const { deps } = fakeDeps({ stored: textFor('b-1', NOON - 1000, [item(1), item(2)]) });
  const copy = createCatalogCopy(deps);
  await copy.load();
  const s = copy.state();
  assert.equal(s.loaded, true);
  assert.equal(s.found, 'copy');
  assert.equal(s.saved, true);
  assert.equal(s.open?.items.length, 2);
  assert.equal(s.open?.at, NOON - 1000);
});

test('a copy of another branch is known about, and not used', async () => {
  const { deps } = fakeDeps({ stored: textFor('b-9', NOON - 1000, [item(1)]) });
  const copy = createCatalogCopy(deps);
  await copy.load();
  const s = copy.state();
  assert.equal(s.loaded, true);
  assert.equal(s.open, null);
  assert.equal(s.stored?.branchId, 'b-9');
});

test('nothing on the phone, text that is not a copy, and a copy from a later app are told apart', async () => {
  for (const [text, found] of [
    [null, 'nothing'],
    ['', 'nothing'],
    ['garbage', 'unreadable'],
    ['{"v":7}', 'newer'],
  ] as const) {
    const copy = createCatalogCopy(fakeDeps({ stored: text }).deps);
    await copy.load();
    const s = copy.state();
    assert.equal(s.loaded, true, String(text));
    assert.equal(s.found, found, String(text));
    assert.equal(s.open, null);
    assert.equal(s.saved, false);
  }
});

test('the phone is read once, however often it is asked', async () => {
  let reads = 0;
  const copy = createCatalogCopy(fakeDeps({ read: async () => { reads += 1; return null; } }).deps);
  await Promise.all([copy.load(), copy.load(), copy.load()]);
  await copy.load();
  assert.equal(reads, 1);
});

test('a phone that cannot be read is not "no copy": nothing is made over it', async () => {
  let wrote = 0;
  let asked = 0;
  const copy = createCatalogCopy(
    fakeDeps({
      read: async () => {
        throw new Error('storage broke');
      },
      write: async () => {
        wrote += 1;
        return true;
      },
      fetchPage: async () => {
        asked += 1;
        return page(0, 1, { last: true });
      },
    }).deps
  );
  await copy.load();
  assert.equal(copy.state().loaded, false);
  await copy.make();
  await copy.makeIfDue();
  assert.equal(wrote, 0);
  assert.equal(asked, 0, 'the shop is not even asked');
});

test('making a copy reads the shop, keeps the text on the phone and opens it', async () => {
  const f = fakeDeps();
  const copy = createCatalogCopy(f.deps);
  await copy.make();
  const s = copy.state();
  assert.equal(f.writes.length, 1);
  assert.equal(f.stored(), f.writes[0]);
  assert.equal(s.saved, true);
  assert.equal(s.making, null);
  assert.equal(s.failure, null);
  assert.deepEqual(s.open?.items.map((i) => i.id), ['i-0', 'i-1', 'i-2']);
  assert.equal(s.open?.at, NOON);
  assert.equal(s.open?.branchId, 'b-1');
  // What is open is what a later reading of the phone would find.
  const again = createCatalogCopy(fakeDeps({ stored: f.stored() }).deps);
  await again.load();
  assert.deepEqual(again.state().open?.items, s.open?.items);
});

test('the time on a copy is when it was made, not when the phone was read', async () => {
  const f = fakeDeps({ stored: textFor('b-1', NOON - 5 * 60 * 60_000, [item(1)]) });
  const copy = createCatalogCopy(f.deps);
  await copy.load();
  f.tick(60_000);
  await copy.make();
  assert.equal(copy.state().open?.at, NOON + 60_000);
});

test('while a copy is being made the screen can see how far it has got', async () => {
  const seen: unknown[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const f = fakeDeps({
    fetchPage: async (n) => {
      if (n === 1) await gate;
      return n === 0 ? page(0, PAGE_SIZE, { last: false, total: PAGE_SIZE + 4 }) : page(PAGE_SIZE, 4, { last: true, total: PAGE_SIZE + 4 });
    },
  });
  const copy = createCatalogCopy(f.deps);
  copy.subscribe(() => seen.push(copy.state().making));
  const done = copy.make();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(copy.state().making, { scanned: PAGE_SIZE, total: PAGE_SIZE + 4 });
  release();
  await done;
  assert.equal(copy.state().making, null);
  assert.ok(seen.length >= 3, 'told at the start, after each page, and at the end');
});

test('two asks to make a copy make one', async () => {
  let asked = 0;
  const copy = createCatalogCopy(fakeDeps({ fetchPage: async (n) => { asked += 1; return page(n, 2, { last: true }); } }).deps);
  await Promise.all([copy.make(), copy.make(), copy.makeIfDue()]);
  assert.equal(asked, 1);
});

test('a copy that fails leaves the one there was exactly as it was, and says why', async () => {
  const before = textFor('b-1', NOON - 1000, [item(7)]);
  const f = fakeDeps({ stored: before, fetchPage: async () => { throw new TypeError('Network request failed'); } });
  const copy = createCatalogCopy(f.deps);
  await copy.load();
  f.tick(5_000);
  await copy.make();
  const s = copy.state();
  assert.deepEqual(s.failure, { at: NOON + 5_000, why: 'no_answer' });
  assert.equal(s.making, null);
  assert.equal(f.writes.length, 0, 'nothing was written');
  assert.equal(f.stored(), before);
  assert.deepEqual(s.open?.items.map((i) => i.id), ['i-7'], 'the earlier list is still the one in use');
});

test('a copy that works clears the failure before it', async () => {
  let fail = true;
  const f = fakeDeps({ fetchPage: async (n) => { if (fail) throw server(403); return page(n, 1, { last: true }); } });
  const copy = createCatalogCopy(f.deps);
  await copy.make();
  assert.equal(copy.state().failure?.why, 'refused');
  fail = false;
  await copy.make();
  assert.equal(copy.state().failure, null);
});

test('a phone that will not keep the copy still gets to use it, and is told it will not last', async () => {
  for (const write of [async () => false, async () => { throw new Error('disk full'); }]) {
    const copy = createCatalogCopy(fakeDeps({ write }).deps);
    await copy.make();
    const s = copy.state();
    assert.equal(s.saved, false);
    assert.equal(s.open?.items.length, 3, 'the list is in use for as long as the app runs');
    assert.equal(s.failure, null);
  }
});

test('a copy is made when there is none, and left alone when it is fresh', async () => {
  const none = fakeDeps();
  const a = createCatalogCopy(none.deps);
  await a.makeIfDue();
  assert.equal(none.writes.length, 1);

  const fresh = fakeDeps({ stored: textFor('b-1', NOON - 60_000, [item(1)]) });
  const b = createCatalogCopy(fresh.deps);
  await b.makeIfDue();
  assert.equal(fresh.writes.length, 0);

  const old = fakeDeps({ stored: textFor('b-1', NOON - 13 * 60 * 60_000, [item(1)]) });
  const c = createCatalogCopy(old.deps);
  await c.makeIfDue();
  assert.equal(old.writes.length, 1);

  const other = fakeDeps({ stored: textFor('b-9', NOON - 60_000, [item(1)]) });
  const d = createCatalogCopy(other.deps);
  await d.makeIfDue();
  assert.equal(other.writes.length, 1, "another branch's list is no use: a copy is made at once");
  assert.equal(d.state().open?.branchId, 'b-1');
});

test('nothing is made on its own while the line is down, or straight after a failure', async () => {
  const down = fakeDeps({ offline: () => true });
  await createCatalogCopy(down.deps).makeIfDue();
  assert.equal(down.writes.length, 0);

  let asked = 0;
  const f = fakeDeps({ fetchPage: async () => { asked += 1; throw new TypeError('Network request failed'); } });
  const copy = createCatalogCopy(f.deps);
  await copy.makeIfDue();
  await copy.makeIfDue();
  assert.equal(asked, 3, 'one try (three asks of the one page), not two');
  f.tick(11 * 60_000);
  await copy.makeIfDue();
  assert.equal(asked, 6, 'and another once the wait is over');
});

test('asking by hand makes a copy even when the last one is fresh', async () => {
  const f = fakeDeps({ stored: textFor('b-1', NOON - 1000, [item(1)]) });
  const copy = createCatalogCopy(f.deps);
  await copy.load();
  await copy.make();
  assert.equal(f.writes.length, 1);
  assert.equal(copy.state().open?.items.length, 3);
});

test('a listener that throws does not stop the others', async () => {
  const copy = createCatalogCopy(fakeDeps().deps);
  let heard = 0;
  copy.subscribe(() => { throw new Error('bad listener'); });
  const stop = copy.subscribe(() => { heard += 1; });
  await copy.make();
  assert.ok(heard > 0);
  const before = heard;
  stop();
  await copy.make();
  assert.equal(heard, before, 'a listener that was removed hears nothing more');
});

// ---- found by breaking the code on purpose: what the tests above did not pin down ---------------------------------

test('progress counts every row the shop sent, the ones that cannot be sold too', async () => {
  const progress: unknown[] = [];
  const pages: CatalogPage[] = [
    { items: [item(1), item(2)], seen: PAGE_SIZE, last: false, total: 2 * PAGE_SIZE },
    { items: [item(3)], seen: 10, last: true, total: 2 * PAGE_SIZE },
  ];
  await readAll({ fetchPage: async (n) => pages[n] as CatalogPage, sleep: instant, onProgress: (p) => progress.push(p) });
  assert.deepEqual(progress, [
    { scanned: PAGE_SIZE, total: 2 * PAGE_SIZE },
    { scanned: PAGE_SIZE + 10, total: 2 * PAGE_SIZE },
  ]);
});

test('a page with nothing on it ends the list even when the shop says there is more', async () => {
  const asked: number[] = [];
  const out = await readAll({
    fetchPage: async (n) => {
      asked.push(n);
      return n === 0 ? page(0, 5, { last: false }) : { items: [], seen: 0, last: false, total: null };
    },
    sleep: instant,
  });
  assert.deepEqual(asked, [0, 1], 'it did not go on asking for pages that are empty');
  assert.equal(out.items.length, 5);
  assert.equal(out.cut, false);
});

test('asking whether a copy is due does not wait for one that is already being made', async () => {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const f = fakeDeps({
    fetchPage: async (n) => {
      await gate;
      return page(n, 3, { last: true, total: 3 });
    },
  });
  const copy = createCatalogCopy(f.deps);
  await copy.load();
  const making = copy.make();
  let answered = false;
  const asking = copy.makeIfDue().then(() => {
    answered = true;
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
  assert.equal(answered, true, 'it carried on at once: a try is already under way');
  open();
  await making;
  await asking;
  assert.equal(f.writes.length, 1, 'and one copy was made, not two');
});

test('a phone that could not be read is read again the next time it is asked, and then used', async () => {
  let reads = 0;
  const f = fakeDeps({
    read: async () => {
      reads += 1;
      if (reads === 1) throw new Error('storage was busy');
      return textFor('b-1', NOON - 1000, [item(1)]);
    },
  });
  const copy = createCatalogCopy(f.deps);
  await copy.load();
  assert.equal(copy.state().loaded, false);
  await copy.load();
  assert.equal(reads, 2, 'a failed read is not remembered as the answer');
  assert.equal(copy.state().loaded, true);
  assert.equal(copy.state().open?.items.length, 1);
});
