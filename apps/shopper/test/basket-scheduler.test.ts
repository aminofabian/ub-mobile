import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptAnswer, hasPending, nextRetryDelayMs, setQuantity, type Change, type ItemFacts, type ServerCart } from '../src/lib/basket';
import { POKE_DELAY_MS, createBasketScheduler, type Timers } from '../src/lib/basket-scheduler';
import { createBasketStore, type BasketStorage } from '../src/lib/basket-store';
import { createSyncRunner, type CartApi, type SyncResult, type SyncRunner } from '../src/lib/basket-sync';
import { ShopApiError } from '../src/lib/shop-http';

const TEA: ItemFacts = { itemId: 'tea', name: 'Tea', unitPrice: 100 };
const MILK: ItemFacts = { itemId: 'milk', name: 'Milk', unitPrice: 100 };

function fakeTimers() {
  let now = 1_000_000;
  let nextId = 1;
  const queue: Array<{ id: number; at: number; callback: () => void; ms: number }> = [];
  const timers: Timers & { advance(ms: number): Promise<void>; scheduled: number[]; pending(): number } = {
    scheduled: [],
    now: () => now,
    set(callback, ms) {
      const entry = { id: nextId++, at: now + ms, callback, ms };
      queue.push(entry);
      timers.scheduled.push(ms);
      return entry.id;
    },
    clear(handle) {
      const index = queue.findIndex((entry) => entry.id === handle);
      if (index >= 0) queue.splice(index, 1);
    },
    pending: () => queue.length,
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        queue.sort((a, b) => a.at - b.at);
        const due = queue[0];
        if (!due || due.at > end) break;
        queue.shift();
        now = due.at;
        due.callback();
        await settle();
      }
      now = end;
    },
  };
  return timers;
}

async function settle() {
  for (let i = 0; i < 12; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

function makeShop() {
  const held = new Map<string, number>();
  let created = 0;
  const shop = {
    online: true,
    gate: null as Promise<void> | null,
    calls: [] as string[],
    held: () => Object.fromEntries(held),
    api: {
      async createCart(): Promise<ServerCart> {
        shop.calls.push('create');
        if (!shop.online) throw new ShopApiError('network', null, '');
        created += 1;
        return view(`cart-${created}`);
      },
      async setLine(cartId: string, change: Change): Promise<ServerCart> {
        shop.calls.push(`set ${change.itemId}=${change.quantity}`);
        if (shop.gate) await shop.gate;
        if (!shop.online) throw new ShopApiError('network', null, '');
        if (change.quantity <= 0) held.delete(change.itemId);
        else held.set(change.itemId, change.quantity);
        return view(cartId);
      },
      async getCart(cartId: string): Promise<ServerCart> {
        shop.calls.push('get');
        if (!shop.online) throw new ShopApiError('network', null, '');
        return view(cartId);
      },
    } satisfies CartApi,
  };
  function view(id: string): ServerCart {
    const lines = [...held].map(([itemId, quantity]) => ({ itemId, name: itemId, quantity, unitPrice: 100, lineTotal: 100 * quantity }));
    return { id, currency: 'KES', expiresAt: '2027-01-01T00:00:00Z', subtotal: lines.reduce((s, l) => s + l.lineTotal, 0), lines };
  }
  return shop;
}

async function harness() {
  const timers = fakeTimers();
  const clock = () => new Date(timers.now());
  const storage: BasketStorage = { read: async () => null, write: async () => undefined };
  const store = createBasketStore(storage, clock);
  await store.settled();
  const shop = makeShop();
  const runner = createSyncRunner(store, shop.api, clock);
  const scheduler = createBasketScheduler({ store, runner, timers });
  const tap = (item: ItemFacts, quantity: number) => store.update((b) => setQuantity(b, item, quantity, clock()));
  return { timers, store, shop, scheduler, tap };
}

test('a tap is sent after a short pause, not at once', async () => {
  const t = await harness();
  t.tap(TEA, 2);
  assert.deepEqual(t.shop.calls, []);
  await t.timers.advance(POKE_DELAY_MS - 1);
  assert.deepEqual(t.shop.calls, []);
  await t.timers.advance(1);
  assert.deepEqual(t.shop.calls, ['create', 'set tea=2']);
  assert.equal(hasPending(t.store.get()), false);
  assert.deepEqual(t.scheduler.state(), { status: 'idle', failures: 0, lastError: null });
});

test('a burst of taps is one send, of the last amount', async () => {
  const t = await harness();
  for (let i = 1; i <= 5; i += 1) {
    t.tap(TEA, i);
    await t.timers.advance(50);
  }
  await t.timers.advance(POKE_DELAY_MS);
  assert.deepEqual(t.shop.calls, ['create', 'set tea=5']);
});

test('with no signal the basket is tried again after waits that grow to a minute', async () => {
  const t = await harness();
  t.shop.online = false;
  t.tap(TEA, 1);
  await t.timers.advance(POKE_DELAY_MS);
  assert.equal(t.scheduler.state().status, 'no-signal');
  assert.equal(t.scheduler.state().failures, 1);
  for (const wait of [5000, 10000, 20000, 40000, 60000, 60000]) {
    assert.equal(t.timers.scheduled.at(-1), wait);
    await t.timers.advance(wait);
  }
  assert.equal(t.scheduler.state().failures, 7);
  assert.equal(t.scheduler.state().lastError?.kind, 'network');
  assert.equal(hasPending(t.store.get()), true, 'and nothing is lost');
});

test('a new tap while waiting to retry does not make the shopper wait out the rest of it', async () => {
  const t = await harness();
  t.shop.online = false;
  t.tap(TEA, 1);
  await t.timers.advance(POKE_DELAY_MS);
  await t.timers.advance(5000);
  assert.equal(t.scheduler.state().failures, 2);
  assert.equal(t.timers.scheduled.at(-1), 10000);
  t.shop.online = true;
  t.tap(TEA, 2);
  await t.timers.advance(POKE_DELAY_MS);
  assert.deepEqual(t.shop.held(), { tea: 2 });
  assert.deepEqual(t.scheduler.state(), { status: 'idle', failures: 0, lastError: null });
  assert.equal(t.timers.pending(), 0, 'no retry left waiting');
});

test('when the signal returns the retry sends everything and the waits start over', async () => {
  const t = await harness();
  t.shop.online = false;
  t.tap(TEA, 1);
  t.tap(MILK, 3);
  await t.timers.advance(POKE_DELAY_MS);
  t.shop.online = true;
  await t.timers.advance(5000);
  assert.deepEqual(t.shop.held(), { tea: 1, milk: 3 });
  assert.equal(t.scheduler.state().failures, 0);
  t.shop.online = false;
  t.tap(TEA, 4);
  await t.timers.advance(POKE_DELAY_MS);
  assert.equal(t.timers.scheduled.at(-1), 5000, 'the first wait again, not the last one');
});

test('sending now sends now, cancels the wait, and says how it went', async () => {
  const t = await harness();
  t.shop.online = false;
  t.tap(TEA, 1);
  await t.timers.advance(POKE_DELAY_MS);
  assert.equal(t.timers.pending(), 1);
  t.shop.online = true;
  const result = await t.scheduler.syncNow();
  assert.equal(result.kind, 'synced');
  assert.equal(t.timers.pending(), 0);
  assert.deepEqual(t.shop.held(), { tea: 1 });
});

test('two asks to send at once are one send, and a failure is counted once', async () => {
  const t = await harness();
  t.shop.online = false;
  t.tap(TEA, 1);
  const [a, b] = await Promise.all([t.scheduler.syncNow(), t.scheduler.syncNow()]);
  assert.equal(a, b, 'the second ask is the first');
  assert.equal(t.scheduler.state().failures, 1);
  assert.equal(t.shop.calls.filter((call) => call === 'create').length, 1);
  assert.equal(t.timers.scheduled.at(-1), 5000);
});

test('sending now with nothing to send is quiet', async () => {
  const t = await harness();
  const heard: string[] = [];
  t.scheduler.subscribe(() => heard.push(t.scheduler.state().status));
  assert.deepEqual(await t.scheduler.syncNow(), { kind: 'idle' });
  assert.deepEqual(heard, []);
  assert.deepEqual(t.shop.calls, []);
});

test('the state goes sending, then idle when it works and no-signal when it does not', async () => {
  const t = await harness();
  const heard: string[] = [];
  t.scheduler.subscribe(() => heard.push(t.scheduler.state().status));
  t.tap(TEA, 1);
  await t.timers.advance(POKE_DELAY_MS);
  assert.deepEqual(heard, ['sending', 'idle']);
  heard.length = 0;
  t.shop.online = false;
  t.tap(TEA, 2);
  await t.timers.advance(POKE_DELAY_MS);
  assert.deepEqual(heard, ['sending', 'no-signal']);
});

test('a change that needs nothing sent starts nothing', async () => {
  const t = await harness();
  t.tap(TEA, 0);
  assert.equal(t.timers.pending(), 0);
  t.scheduler.poke();
  assert.equal(t.timers.pending(), 0);
});

test('taking back what was waiting while there is no signal ends the waiting', async () => {
  const t = await harness();
  t.shop.online = false;
  t.tap(TEA, 1);
  await t.timers.advance(POKE_DELAY_MS);
  assert.equal(t.scheduler.state().status, 'no-signal');
  t.tap(TEA, 0);
  assert.deepEqual(t.scheduler.state(), { status: 'idle', failures: 0, lastError: null });
  assert.equal(t.timers.pending(), 0);
});

test('a tap made while a send is on its way goes with that send or the one after, and is not lost', async () => {
  const t = await harness();
  t.tap(TEA, 1);
  let release!: () => void;
  t.shop.gate = new Promise<void>((resolve) => (release = resolve));
  await t.timers.advance(POKE_DELAY_MS);
  assert.equal(t.scheduler.state().status, 'sending');
  t.tap(MILK, 2);
  t.shop.gate = null;
  release();
  await settle();
  await t.timers.advance(POKE_DELAY_MS * 2);
  assert.deepEqual(t.shop.held(), { tea: 1, milk: 2 });
  assert.equal(hasPending(t.store.get()), false);
});

test('a send that fails after the shopper took everything back out leaves a retry that finds nothing to send and ends the waiting', async () => {
  const t = await harness();
  t.tap(TEA, 1);
  let release!: () => void;
  t.shop.gate = new Promise<void>((resolve) => (release = resolve));
  await t.timers.advance(POKE_DELAY_MS); // the cart is made, and the line is on its way, held by the shop
  assert.equal(t.scheduler.state().status, 'sending');
  t.tap(TEA, 0); // taken back while the shop is being told
  t.shop.online = false;
  t.shop.gate = null;
  release();
  await settle();
  assert.equal(t.scheduler.state().status, 'no-signal', 'the send failed');
  assert.equal(t.timers.pending(), 1, 'and a retry is waiting');
  await t.timers.advance(nextRetryDelayMs(1));
  assert.deepEqual(t.scheduler.state(), { status: 'idle', failures: 0, lastError: null }, 'it finds nothing to send, and is done');
  assert.equal(t.timers.pending(), 0);
});

test('a line the shop refused is not tried again on a timer', async () => {
  const t = await harness();
  t.tap(TEA, 1);
  t.store.update((b) => ({ ...b, refused: { tea: 'Only 0 available at this store' } }));
  assert.equal(hasPending(t.store.get()), false);
  await t.timers.advance(POKE_DELAY_MS * 3);
  assert.deepEqual(t.shop.calls, []);
});

test('after it is disposed nothing is sent and no timer is left', async () => {
  const t = await harness();
  t.tap(TEA, 1);
  assert.equal(t.timers.pending(), 1);
  t.scheduler.dispose();
  assert.equal(t.timers.pending(), 0);
  t.tap(TEA, 2);
  await t.timers.advance(POKE_DELAY_MS * 3);
  assert.deepEqual(t.shop.calls, []);
  assert.deepEqual(await t.scheduler.syncNow(), { kind: 'idle' });
});

async function bareStore(timers: ReturnType<typeof fakeTimers>) {
  const clock = () => new Date(timers.now());
  const store = createBasketStore({ read: async () => null, write: async () => undefined }, clock);
  await store.settled();
  return { store, clock };
}

test('what is still waiting when a send ends is sent again soon, without another tap', async () => {
  const timers = fakeTimers();
  const { store, clock } = await bareStore(timers);
  let runs = 0;
  const runner: SyncRunner = {
    isRunning: () => false,
    async run(): Promise<SyncResult> {
      runs += 1;
      // The first run ends with the tap still not told to the shop, as when it came in after the run had looked.
      if (runs >= 2) {
        store.update((b) => acceptAnswer(b, { id: 'c1', subtotal: 100, lines: [{ itemId: 'tea', quantity: 1, unitPrice: 100, lineTotal: 100 }] }, clock()));
      }
      return { kind: 'synced' };
    },
  };
  const scheduler = createBasketScheduler({ store, runner, timers });
  store.update((b) => setQuantity(b, TEA, 1, clock()));
  await timers.advance(POKE_DELAY_MS);
  assert.equal(runs, 1);
  await timers.advance(POKE_DELAY_MS);
  assert.equal(runs, 2, 'sent again after a short pause');
  assert.equal(hasPending(store.get()), false);
  assert.equal(scheduler.state().status, 'idle');
});

test('a second ask to send during a send is passed to the runner, which folds it into the run', async () => {
  const timers = fakeTimers();
  const { store, clock } = await bareStore(timers);
  const shop = makeShop();
  const real = createSyncRunner(store, shop.api, clock);
  let asks = 0;
  const runner: SyncRunner = {
    isRunning: () => real.isRunning(),
    run() {
      asks += 1;
      return real.run();
    },
  };
  const scheduler = createBasketScheduler({ store, runner, timers });
  store.update((b) => setQuantity(b, TEA, 1, clock()));
  let release!: () => void;
  shop.gate = new Promise<void>((resolve) => (release = resolve));
  const first = scheduler.syncNow();
  const second = scheduler.syncNow();
  assert.equal(asks, 2, 'the runner was told twice, and it makes one run of it');
  shop.gate = null;
  release();
  await Promise.all([first, second]);
  assert.deepEqual(shop.calls.filter((call) => call === 'create'), ['create']);
});

test('a runner that fails unexpectedly is treated as no signal, and backs off instead of spinning', async () => {
  const timers = fakeTimers();
  const { store, clock } = await bareStore(timers);
  const runner: SyncRunner = {
    isRunning: () => false,
    run: async () => {
      throw new Error('boom');
    },
  };
  const scheduler = createBasketScheduler({ store, runner, timers });
  store.update((b) => setQuantity(b, TEA, 1, clock()));
  await timers.advance(POKE_DELAY_MS);
  assert.equal(scheduler.state().status, 'no-signal');
  assert.equal(scheduler.state().failures, 1);
  assert.equal(timers.scheduled[timers.scheduled.length - 1], 5_000, 'the next try is a wait away, not a moment');
});
