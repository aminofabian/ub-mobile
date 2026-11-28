import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyBasket, pendingChanges, quantityOf, readyToOrder, setQuantity, viewOf, type Change, type ItemFacts, type ServerCart } from '../src/lib/basket';
import { createBasketStore, type BasketStorage } from '../src/lib/basket-store';
import { createSyncRunner, isStale, MAX_UNMOVED_ANSWERS, pushPending, READ_AFTER_MS, readFromShop, refusalText, type CartApi } from '../src/lib/basket-sync';
import { ShopApiError } from '../src/lib/shop-http';

const TEA: ItemFacts = { itemId: 'tea', name: 'Tea', unitPrice: 120 };
const MILK: ItemFacts = { itemId: 'milk', name: 'Milk', unitPrice: 65 };
const EGGS: ItemFacts = { itemId: 'eggs', name: 'Eggs', unitPrice: 30 };

let tick = 0;
const clock = () => new Date(Date.UTC(2026, 10, 23, 9, 0, (tick += 1)));

function memoryStorage(initial: string | null = null): BasketStorage & { raw: string | null; writes: number } {
  const storage = {
    raw: initial,
    writes: 0,
    read: async () => storage.raw,
    write: async (raw: string) => {
      storage.raw = raw;
      storage.writes += 1;
    },
  };
  return storage;
}

/** A shop with a few items in stock, prices of 100 each, and a switch for the signal. */
function fakeShop(stock: Record<string, number> = { tea: 5, milk: 2, eggs: 10 }) {
  const carts = new Map<string, Map<string, number>>();
  const shop = {
    offline: false,
    fault: null as ShopApiError | null,
    gate: null as Promise<void> | null,
    /** Holds back the answer to a read of the cart, which is a picture taken when the shop looked. */
    readGate: null as Promise<void> | null,
    /** What each item costs, which the shop can change without the phone being told. */
    price: 100,
    calls: [] as string[],
    created: 0,
    drop(cartId: string) {
      carts.delete(cartId);
    },
    held(cartId: string): Record<string, number> {
      return Object.fromEntries(carts.get(cartId) ?? []);
    },
    api: {
      async createCart(): Promise<ServerCart> {
        shop.calls.push('create');
        if (shop.offline) throw new ShopApiError('network', null, '');
        shop.created += 1;
        const id = `cart-${shop.created}`;
        carts.set(id, new Map());
        return view(id);
      },
      async setLine(cartId: string, change: Change): Promise<ServerCart> {
        shop.calls.push(`set ${change.itemId}=${change.quantity}`);
        if (shop.gate) await shop.gate;
        if (shop.offline) throw new ShopApiError('network', null, '');
        if (shop.fault) throw shop.fault;
        const cart = carts.get(cartId);
        if (!cart) throw new ShopApiError('http', 404, 'Cart not found or expired');
        if (change.quantity <= 0) cart.delete(change.itemId);
        else {
          const available = stock[change.itemId] ?? 0;
          if (change.quantity > available) throw new ShopApiError('http', 400, `Only ${available} available at this store`);
          cart.set(change.itemId, change.quantity);
        }
        return view(cartId);
      },
      async getCart(cartId: string): Promise<ServerCart> {
        shop.calls.push('get');
        const picture = carts.has(cartId) ? view(cartId) : null; // what the shop holds the moment it looks
        if (shop.readGate) await shop.readGate;
        if (shop.offline) throw new ShopApiError('network', null, '');
        if (shop.fault) throw shop.fault;
        if (!picture) throw new ShopApiError('http', 404, 'Cart not found or expired');
        return picture;
      },
    } satisfies CartApi,
  };
  function view(id: string): ServerCart {
    const cart = carts.get(id)!;
    const lines = [...cart].map(([itemId, quantity]) => ({ itemId, name: itemId, quantity, unitPrice: shop.price, lineTotal: shop.price * quantity }));
    return { id, currency: 'KES', expiresAt: '2026-12-30T00:00:00.000Z', subtotal: lines.reduce((s, l) => s + l.lineTotal, 0), lines };
  }
  return shop;
}

async function started(storage = memoryStorage()) {
  const store = createBasketStore(storage, clock);
  await store.settled();
  return store;
}

test('taps with no signal are kept and shown, and nothing is sent', async () => {
  const shop = fakeShop();
  shop.offline = true;
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  store.update((b) => setQuantity(b, MILK, 1, clock()));
  const result = await pushPending(store, shop.api, clock);
  assert.equal(result.kind, 'offline');
  assert.deepEqual(store.get().lines.map((l) => [l.itemId, l.quantity]), [['tea', 2], ['milk', 1]]);
  assert.equal(pendingChanges(store.get()).length, 2);
  assert.equal(viewOf(store.get()).isEstimate, true);
});

test('when the signal returns the cart is made and told everything, once, and the order can be placed', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  store.update((b) => setQuantity(b, MILK, 1, clock()));
  const result = await pushPending(store, shop.api, clock);
  assert.equal(result.kind, 'synced');
  assert.deepEqual(shop.calls, ['create', 'set tea=2', 'set milk=1']);
  assert.deepEqual(shop.held('cart-1'), { tea: 2, milk: 1 });
  assert.equal(store.get().cartId, 'cart-1');
  assert.deepEqual(viewOf(store.get()), { currency: 'KES', subtotal: 300, isEstimate: false, waiting: false });
  assert.deepEqual(readyToOrder(store.get(), clock()), { ready: true });
  assert.deepEqual(await pushPending(store, shop.api, clock), { kind: 'idle' }, 'nothing left to tell');
});

test('the signal going in the middle stops there, keeps the rest, and the next try carries on', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(setQuantity(setQuantity(b, TEA, 2, clock()), MILK, 1, clock()), EGGS, 6, clock()));
  let calls = 0;
  const flaky: CartApi = {
    createCart: shop.api.createCart,
    setLine: async (cartId, change) => {
      calls += 1;
      if (calls === 2) throw new ShopApiError('timeout', null, '');
      return shop.api.setLine(cartId, change);
    },
  };
  const first = await pushPending(store, flaky, clock);
  assert.equal(first.kind, 'offline');
  assert.deepEqual(shop.held('cart-1'), { tea: 2 });
  assert.deepEqual(pendingChanges(store.get()).map((c) => c.itemId), ['milk', 'eggs']);
  const second = await pushPending(store, shop.api, clock);
  assert.equal(second.kind, 'synced');
  assert.deepEqual(shop.held('cart-1'), { tea: 2, milk: 1, eggs: 6 });
  assert.equal(shop.created, 1, 'the same cart, not a new one');
});

test('a server fault is not an answer about the line, so the line is not held against', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  shop.fault = new ShopApiError('http', 503, '');
  const result = await pushPending(store, shop.api, clock);
  assert.equal(result.kind, 'offline');
  assert.deepEqual(store.get().refused, {});
  shop.fault = null;
  assert.equal((await pushPending(store, shop.api, clock)).kind, 'synced');
});

test('a tap made while the shop is being told is not lost', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  await pushPending(store, shop.api, clock);
  store.update((b) => setQuantity(b, TEA, 3, clock()));
  let release!: () => void;
  shop.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const running = pushPending(store, shop.api, clock);
  await new Promise((resolve) => setImmediate(resolve));
  store.update((b) => setQuantity(b, TEA, 4, clock()));
  shop.gate = null;
  release();
  const result = await running;
  assert.equal(result.kind, 'synced');
  assert.equal(quantityOf(store.get(), 'tea'), 4);
  assert.deepEqual(shop.held('cart-1'), { tea: 4 });
  assert.deepEqual(pendingChanges(store.get()), []);
});

test('a line the shopper put back as it was, while the shop was being told the change, is told again, not undone by the answer', async () => {
  for (const [from, to] of [[2, 3], [3, 4], [4, 5]]) {
    const shop = fakeShop({ tea: 9, milk: 9, eggs: 9 });
    const store = await started();
    store.update((b) => setQuantity(b, TEA, from, clock()));
    await pushPending(store, shop.api, clock);
    store.update((b) => setQuantity(b, TEA, to, clock()));
    let release!: () => void;
    shop.gate = new Promise<void>((resolve) => (release = resolve));
    const running = pushPending(store, shop.api, clock); // the shop is told "to"
    await new Promise((resolve) => setImmediate(resolve));
    store.update((b) => setQuantity(b, TEA, from, clock())); // the shopper takes it back
    shop.gate = null;
    release();
    assert.equal((await running).kind, 'synced');
    assert.equal(quantityOf(store.get(), 'tea'), from, `${from}->${to}->${from}: what the shopper last chose`);
    assert.deepEqual(shop.held('cart-1'), { tea: from }, 'and what the shop holds');
    assert.deepEqual(pendingChanges(store.get()), []);
  }
});

test('a new line the shopper took out again while the shop was being told it is taken out of the shop\'s cart, not brought back by the answer', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  await pushPending(store, shop.api, clock);
  store.update((b) => setQuantity(b, MILK, 1, clock()));
  let release!: () => void;
  shop.gate = new Promise<void>((resolve) => (release = resolve));
  const running = pushPending(store, shop.api, clock); // the shop is told the milk
  await new Promise((resolve) => setImmediate(resolve));
  store.update((b) => setQuantity(b, MILK, 0, clock()));
  shop.gate = null;
  release();
  assert.equal((await running).kind, 'synced');
  assert.deepEqual(store.get().lines.map((l) => l.itemId), ['tea']);
  assert.deepEqual(shop.held('cart-1'), { tea: 2 });
});

test('a refusal of an amount the shopper has since changed is not held against the new amount', async () => {
  const shop = fakeShop({ tea: 5, milk: 2, eggs: 10 });
  const store = await started();
  store.update((b) => setQuantity(b, EGGS, 1, clock()));
  await pushPending(store, shop.api, clock);
  store.update((b) => setQuantity(b, TEA, 9, clock())); // more than the shop has
  let release!: () => void;
  shop.gate = new Promise<void>((resolve) => (release = resolve));
  const running = pushPending(store, shop.api, clock);
  await new Promise((resolve) => setImmediate(resolve));
  store.update((b) => setQuantity(b, TEA, 3, clock())); // the shopper lowers it before the answer
  shop.gate = null;
  release();
  assert.equal((await running).kind, 'synced');
  assert.equal(store.get().refused.tea, undefined, 'the shop\'s "no" was to 9');
  assert.equal(quantityOf(store.get(), 'tea'), 3);
  assert.deepEqual(shop.held('cart-1'), { eggs: 1, tea: 3 });
});

test('a shop that keeps answering a line with another amount is asked a few times, not for ever', async () => {
  const shop = fakeShop();
  const store = await started();
  const asked: string[] = [];
  const stubborn: CartApi = {
    createCart: shop.api.createCart,
    getCart: shop.api.getCart,
    async setLine(cartId, change) {
      asked.push(`${change.itemId}=${change.quantity}`);
      return shop.api.setLine(cartId, { itemId: change.itemId, quantity: 1 }); // whatever is asked, the shop holds 1
    },
  };
  store.update((b) => setQuantity(b, TEA, 4, clock()));
  const result = await pushPending(store, stubborn, clock);
  assert.equal(result.kind, 'offline');
  assert.deepEqual(asked, Array(MAX_UNMOVED_ANSWERS).fill('tea=4'));
  assert.equal(quantityOf(store.get(), 'tea'), 4, 'the shopper\'s amount stands');
  assert.deepEqual(pendingChanges(store.get()), [{ itemId: 'tea', quantity: 4 }], 'and is still to be told');
  assert.deepEqual(readyToOrder(store.get(), clock()), { ready: false, why: 'waiting' });
  assert.equal((await pushPending(store, stubborn, clock)).kind, 'offline');
  assert.equal(asked.length, 2 * MAX_UNMOVED_ANSWERS, 'the next try is again a few calls, not hundreds');
});

test('the count of answers that did not move a line starts again when the shopper changes the line', async () => {
  const shop = fakeShop({ tea: 9, milk: 9, eggs: 9 });
  const store = await started();
  const asked: string[] = [];
  let n = 0;
  const taps: Record<number, number> = { 2: 2, 3: 4 }; // during the 2nd call the shopper makes it 2; during the 3rd, 4
  const api: CartApi = {
    createCart: shop.api.createCart,
    getCart: shop.api.getCart,
    async setLine(cartId, change) {
      n += 1;
      asked.push(`${change.itemId}=${change.quantity}`);
      const tap = taps[n];
      if (tap !== undefined) store.update((b) => setQuantity(b, TEA, tap, clock()));
      // The shop holds 1 of what it is asked for 4, and takes what it is asked for 2.
      return shop.api.setLine(cartId, { itemId: change.itemId, quantity: change.quantity === 4 ? 1 : change.quantity });
    },
  };
  store.update((b) => setQuantity(b, TEA, 4, clock()));
  const result = await pushPending(store, api, clock);
  assert.equal(result.kind, 'offline');
  assert.deepEqual(asked, ['tea=4', 'tea=4', 'tea=2', 'tea=4', 'tea=4', 'tea=4'], 'two answers that did not move it, then a change of line, then three');
});

test('a shop taken off the phone is not told anything more, and nothing is written back', async () => {
  const shop = fakeShop();
  const storage = memoryStorage();
  const store = await started(storage);
  store.update((b) => setQuantity(setQuantity(b, TEA, 2, clock()), MILK, 1, clock()));
  await store.settled();
  let release!: () => void;
  shop.gate = new Promise<void>((resolve) => (release = resolve));
  const running = pushPending(store, shop.api, clock);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(shop.calls, ['create', 'set tea=2']);
  storage.raw = null; // "Remove from this phone": what was kept is removed...
  const writes = storage.writes;
  store.close(); // ...and the shop's session is closed
  shop.gate = null;
  release();
  await running;
  await store.settled();
  assert.deepEqual(shop.calls, ['create', 'set tea=2'], 'the milk is not told to the shop');
  assert.equal(storage.raw, null, 'the basket is not written back');
  assert.equal(storage.writes, writes);
});

test('a closed store takes no change, tells no one, and writes nothing, even for what was already waiting to be written', async () => {
  const storage = memoryStorage();
  const store = await started(storage);
  let heard = 0;
  store.subscribe(() => (heard += 1));
  store.update((b) => setQuantity(b, TEA, 1, clock())); // written after the close below, by the queue
  const writes = storage.writes;
  store.close();
  assert.equal(store.isClosed(), true);
  const before = store.get();
  store.update((b) => setQuantity(b, MILK, 2, clock()));
  assert.equal(store.get(), before, 'a tap is ignored');
  await store.settled();
  assert.equal(heard, 1, 'only what came before');
  assert.equal(storage.writes, writes, 'nothing is written after the close');
});

test('a store closed before the saved basket was read does not write it back', async () => {
  const storage = memoryStorage('{"anything":1}');
  const store = createBasketStore(storage, clock);
  let heard = 0;
  store.subscribe(() => (heard += 1));
  store.update((b) => setQuantity(b, TEA, 1, clock())); // waits for the read
  store.close();
  await store.settled();
  assert.equal(heard, 0, 'no one is told of a basket that was taken off the phone');
  assert.equal(storage.writes, 0);
  assert.equal(quantityOf(store.get(), 'tea'), 0, 'the change that was waiting went with it');
});

test('a line taken out is taken out of the shop\'s cart too', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(setQuantity(b, TEA, 2, clock()), MILK, 1, clock()));
  await pushPending(store, shop.api, clock);
  store.update((b) => setQuantity(b, TEA, 0, clock()));
  assert.equal((await pushPending(store, shop.api, clock)).kind, 'synced');
  assert.deepEqual(shop.held('cart-1'), { milk: 1 });
  assert.deepEqual(store.get().lines.map((l) => l.itemId), ['milk']);
});

test('a cart the shop dropped is made again and told everything, and the shopper sees no change', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(setQuantity(b, TEA, 2, clock()), MILK, 1, clock()));
  await pushPending(store, shop.api, clock);
  shop.drop('cart-1');
  store.update((b) => setQuantity(b, EGGS, 3, clock()));
  const result = await pushPending(store, shop.api, clock);
  assert.equal(result.kind, 'synced');
  assert.equal(shop.created, 2);
  assert.equal(store.get().cartId, 'cart-2');
  assert.deepEqual(shop.held('cart-2'), { tea: 2, milk: 1, eggs: 3 });
  assert.deepEqual(store.get().lines.map((l) => [l.itemId, l.quantity]), [['tea', 2], ['milk', 1], ['eggs', 3]]);
});

test('a cart that is gone every time is given up on, not made again for ever', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  const always404: CartApi = {
    createCart: shop.api.createCart,
    setLine: async () => {
      throw new ShopApiError('http', 404, 'Cart not found or expired');
    },
  };
  const result = await pushPending(store, always404, clock);
  assert.equal(result.kind, 'offline');
  assert.ok(shop.created <= 3, `made ${shop.created} carts`);
  assert.equal(store.get().lines.length, 1, 'the line is still there');
});

test('a line the shop will not take keeps the shop\'s words, and the other lines are still sent', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(setQuantity(b, MILK, 7, clock()), TEA, 2, clock()));
  const result = await pushPending(store, shop.api, clock);
  assert.equal(result.kind, 'synced');
  assert.deepEqual(shop.held('cart-1'), { tea: 2 });
  assert.equal(store.get().refused.milk, 'Only 2 available at this store');
  assert.deepEqual(readyToOrder(store.get(), clock()), { ready: false, why: 'refused' });
  assert.equal(quantityOf(store.get(), 'milk'), 7, 'the shopper\'s amount is left for the shopper to change');
  assert.deepEqual(await pushPending(store, shop.api, clock), { kind: 'idle' }, 'and it is not sent again on its own');
  store.update((b) => setQuantity(b, MILK, 2, clock()));
  assert.equal((await pushPending(store, shop.api, clock)).kind, 'synced');
  assert.deepEqual(shop.held('cart-1'), { tea: 2, milk: 2 });
  assert.deepEqual(readyToOrder(store.get(), clock()), { ready: true });
});

test('a refusal with no words is given some', () => {
  assert.equal(refusalText(new ShopApiError('http', 400, 'Cart is full')), 'Cart is full');
  assert.match(refusalText(new ShopApiError('http', 400, '')), /could not take this/);
});

test('two requests to send at once are one: the shop is not told twice', async () => {
  const shop = fakeShop();
  const store = await started();
  const runner = createSyncRunner(store, shop.api, clock);
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  const [a, b] = await Promise.all([runner.run(), runner.run()]);
  assert.equal(a.kind === 'synced' || a.kind === 'idle', true);
  assert.equal(b, a, 'the second call is the first');
  assert.deepEqual(shop.calls, ['create', 'set tea=2']);
  assert.equal(runner.isRunning(), false);
});

test('a tap made while a send is running is sent by that same run', async () => {
  const shop = fakeShop();
  const store = await started();
  const runner = createSyncRunner(store, shop.api, clock);
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  const running = runner.run();
  await new Promise((resolve) => setImmediate(resolve));
  store.update((b) => setQuantity(b, MILK, 1, clock()));
  const again = runner.run();
  await Promise.all([running, again]);
  assert.deepEqual(shop.held('cart-1'), { tea: 2, milk: 1 });
});

test('the basket is written to the phone as it changes, and is there when the app is opened again', async () => {
  const storage = memoryStorage();
  const store = await started(storage);
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  await store.settled();
  assert.ok(storage.writes >= 1);
  const reopened = await started(memoryStorage(storage.raw));
  assert.deepEqual(reopened.get().lines.map((l) => [l.itemId, l.quantity]), [['tea', 2]]);
  assert.equal(reopened.isLoaded(), true);
});

test('a tap made before the saved basket has been read is applied to it, not lost to it', async () => {
  const saved = memoryStorage();
  const first = await started(saved);
  first.update((b) => setQuantity(b, TEA, 2, clock()));
  await first.settled();
  let finish!: (raw: string | null) => void;
  const slow: BasketStorage = {
    read: () => new Promise((resolve) => (finish = resolve)),
    write: async () => undefined,
  };
  const store = createBasketStore(slow, clock);
  assert.equal(store.isLoaded(), false);
  store.update((b) => setQuantity(b, MILK, 1, clock()));
  assert.deepEqual(store.get().lines, [], 'nothing is shown until what was kept is read');
  finish(saved.raw);
  await store.settled();
  assert.deepEqual(store.get().lines.map((l) => [l.itemId, l.quantity]), [['tea', 2], ['milk', 1]]);
});

test('a basket that cannot be read, or written, is an empty basket and a working one', async () => {
  const broken: BasketStorage = {
    read: async () => {
      throw new Error('disk');
    },
    write: async () => {
      throw new Error('disk');
    },
  };
  const store = createBasketStore(broken, clock);
  await store.settled();
  store.update((b) => setQuantity(b, TEA, 1, clock()));
  await store.settled();
  assert.equal(quantityOf(store.get(), 'tea'), 1);
});

test('listeners hear every change, and stop hearing when they leave', async () => {
  const store = await started();
  let heard = 0;
  const leave = store.subscribe(() => {
    heard += 1;
  });
  store.update((b) => setQuantity(b, TEA, 1, clock()));
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  assert.equal(heard, 2);
  leave();
  store.update((b) => setQuantity(b, TEA, 3, clock()));
  assert.equal(heard, 2);
});

test('an empty basket is idle', async () => {
  const shop = fakeShop();
  const store = await started();
  assert.deepEqual(await pushPending(store, shop.api, clock), { kind: 'idle' });
  assert.deepEqual(shop.calls, []);
  assert.deepEqual(emptyBasket(clock()).lines, []);
});

test('a shop that is busy or slow has not answered about the line, so the line is not held against', async () => {
  for (const status of [408, 429]) {
    const shop = fakeShop();
    const store = await started();
    store.update((b) => setQuantity(b, TEA, 2, clock()));
    shop.fault = new ShopApiError('http', status, 'Slow down');
    assert.equal((await pushPending(store, shop.api, clock)).kind, 'offline', String(status));
    assert.deepEqual(store.get().refused, {}, String(status));
  }
});

test('an answer that could not be read says nothing about the line, whatever its status was', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  shop.fault = new ShopApiError('unreadable', 400, '');
  assert.equal((await pushPending(store, shop.api, clock)).kind, 'offline');
  assert.deepEqual(store.get().refused, {});
});

test('a refusal when the cart is being made is not held against a line', async () => {
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  const api: CartApi = {
    createCart: async () => {
      throw new ShopApiError('http', 400, 'The shop is closed');
    },
    setLine: async () => {
      throw new Error('not reached');
    },
  };
  assert.equal((await pushPending(store, api, clock)).kind, 'offline');
  assert.deepEqual(store.get().refused, {});
});

test('an instruction meant for the shop\'s staff is not shown to a shopper', () => {
  const text = refusalText(new ShopApiError('http', 400, 'No online price for Tea. Set a shelf price in Products, or remove the item.'));
  assert.doesNotMatch(text, /shelf price|products/i);
  assert.match(text, /not put a price/);
});

test('a send asked for just as one is finishing is not lost', async () => {
  const shop = fakeShop();
  const real = await started();
  let runner: ReturnType<typeof createSyncRunner> | null = null;
  let armed = true;
  const store: typeof real = {
    ...real,
    get() {
      const basket = real.get();
      if (armed && basket.cartId !== null && pendingChanges(basket).length === 0) {
        // The last look found nothing to send. Before the run has ended, a tap is made and a send is asked for.
        armed = false;
        queueMicrotask(() => {
          real.update((b) => setQuantity(b, MILK, 1, clock()));
          void runner?.run();
        });
      }
      return basket;
    },
  };
  runner = createSyncRunner(store, shop.api, clock);
  real.update((b) => setQuantity(b, TEA, 2, clock()));
  await runner.run();
  assert.deepEqual(shop.held('cart-1'), { tea: 2, milk: 1 });
});

test('the shop\'s last word is old after two minutes, and a basket with nothing sent has nothing to ask about', async () => {
  const shop = fakeShop();
  const store = await started();
  assert.equal(isStale(store.get(), clock()), false, 'an empty basket');
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  shop.offline = true;
  await pushPending(store, shop.api, clock);
  assert.equal(isStale(store.get(), clock()), false, 'lines the shop has not heard are sent, not asked about');
  shop.offline = false;
  await pushPending(store, shop.api, clock);
  const basket = store.get();
  const answered = Date.parse(basket.answeredAt as string);
  assert.equal(isStale(basket, new Date(answered + READ_AFTER_MS - 1)), false);
  assert.equal(isStale(basket, new Date(answered + READ_AFTER_MS)), true);
  assert.equal(isStale({ ...basket, answeredAt: null }, new Date(answered)), true, 'never answered');
  assert.equal(isStale({ ...basket, answeredAt: 'yesterday' }, new Date(answered)), true, 'an unreadable time is as good as none');
  assert.equal(isStale({ ...basket, lines: [] }, new Date(answered + READ_AFTER_MS * 10)), false, 'nothing left in it');
});

test('asking the shop for its cart brings its prices and keeps what the shopper has done since', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  await pushPending(store, shop.api, clock);
  shop.price = 120; // the shop changed its prices after it last answered
  store.update((b) => setQuantity(b, MILK, 1, clock())); // a tap the shop has not heard
  assert.deepEqual(await readFromShop(store, shop.api, clock), { kind: 'synced' });
  const tea = store.get().lines.find((l) => l.itemId === 'tea');
  assert.equal(tea?.unitPrice, 120);
  assert.equal(tea?.lineTotal, 240);
  assert.equal(store.get().subtotal, 240, 'the shop\'s total of what it holds');
  assert.equal(quantityOf(store.get(), 'milk'), 1, 'the tap is kept');
  assert.deepEqual(pendingChanges(store.get()).map((c) => c.itemId), ['milk'], 'and still to be sent');
});

test('a cart the shop no longer has is let go when asked about, and its lines go to a new one', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(setQuantity(b, TEA, 2, clock()), MILK, 1, clock()));
  await pushPending(store, shop.api, clock);
  shop.drop('cart-1');
  assert.deepEqual(await readFromShop(store, shop.api, clock), { kind: 'synced' });
  assert.equal(store.get().cartId, null);
  assert.equal(store.get().lines.length, 2, 'the lines are kept');
  assert.equal(pendingChanges(store.get()).length, 2, 'all to be sent again');
  await pushPending(store, shop.api, clock);
  assert.deepEqual(shop.held('cart-2'), { tea: 2, milk: 1 });
});

test('no answer when asking for the cart leaves the basket exactly as it was', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  await pushPending(store, shop.api, clock);
  const before = store.get();
  shop.offline = true;
  const none = await readFromShop(store, shop.api, clock);
  assert.equal(none.kind, 'offline');
  assert.equal(store.get(), before);
  shop.offline = false;
  shop.fault = new ShopApiError('http', 500, '');
  assert.equal((await readFromShop(store, shop.api, clock)).kind, 'offline', 'a fault is not an answer about the cart');
  assert.equal(store.get(), before);
});

test('a basket with no cart has nothing to ask the shop about, and the shop is not asked', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  assert.deepEqual(await readFromShop(store, shop.api, clock), { kind: 'idle' });
  assert.deepEqual(shop.calls, []);
});

test('a slow answer about the cart is not laid over what the shopper did while it was coming', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  await pushPending(store, shop.api, clock);
  let release!: () => void;
  shop.readGate = new Promise<void>((resolve) => (release = resolve));
  const reading = readFromShop(store, shop.api, clock); // the picture is taken now: tea only
  store.update((b) => setQuantity(b, MILK, 1, clock()));
  const changed = store.get();
  release();
  await reading;
  assert.equal(store.get(), changed, 'the old picture was not taken');
});

test('a slow answer that is older than a send that was answered meanwhile does not take the new line away', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  await pushPending(store, shop.api, clock);
  let release!: () => void;
  shop.readGate = new Promise<void>((resolve) => (release = resolve));
  const reading = readFromShop(store, shop.api, clock); // the picture is taken now: tea only
  store.update((b) => setQuantity(b, MILK, 1, clock()));
  shop.readGate = null;
  await pushPending(store, shop.api, clock); // the shop is told about the milk and says so
  assert.deepEqual(pendingChanges(store.get()), []);
  release();
  await reading;
  assert.deepEqual(store.get().lines.map((l) => [l.itemId, l.quantity]), [['tea', 2], ['milk', 1]], 'the milk is still there');
});

test('a slow "no such cart" is not acted on if the basket has changed since it was asked', async () => {
  const shop = fakeShop();
  const store = await started();
  store.update((b) => setQuantity(b, TEA, 2, clock()));
  await pushPending(store, shop.api, clock);
  shop.drop('cart-1');
  let release!: () => void;
  shop.readGate = new Promise<void>((resolve) => (release = resolve));
  const reading = readFromShop(store, shop.api, clock);
  store.update((b) => setQuantity(b, MILK, 1, clock()));
  release();
  await reading;
  assert.equal(store.get().cartId, 'cart-1', 'the cart is not let go on the strength of an answer to an older basket');
  shop.readGate = null;
  await pushPending(store, shop.api, clock); // the next send finds out for itself, and puts the lines in a new cart
  assert.deepEqual(shop.held('cart-2'), { tea: 2, milk: 1 });
});
