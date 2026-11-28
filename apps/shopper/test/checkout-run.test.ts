import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setQuantity, type Change, type ServerCart } from '../src/lib/basket';
import { createBasketStore, type BasketStorage } from '../src/lib/basket-store';
import { createSyncRunner, readFromShop, type CartApi } from '../src/lib/basket-sync';
import type { ContactStep, DeliveryStep, OrderPlan } from '../src/lib/checkout-form';
import { IN_DOUBT_MIN_GAP_MS, type DoubtRecord, type KnownOrder, type OrderRequestSent } from '../src/lib/checkout-outcome';
import { createCheckoutRunner, type CheckoutApi, type DoubtStorage, type PlacedOrder } from '../src/lib/checkout-run';
import { ShopApiError } from '../src/lib/shop-http';

const REQUEST: OrderRequestSent = {
  customerName: 'Wanjiru Kamau',
  customerPhone: '+254 712345678',
  customerEmail: 'w@example.com',
  notes: 'Street: Moi Ave | County: Nairobi',
};
const CONTACT: ContactStep = { firstName: 'Wanjiru', lastName: 'Kamau', email: 'w@example.com', areaCode: '+254', phone: '712345678', whatsApp: '' };
const DELIVERY: DeliveryStep = { county: 'Nairobi', subCounty: 'Westlands', ward: '', streetAddress: 'Moi Ave', deliveryNotes: '', saveForNextTime: false };

function plan(over: Partial<OrderPlan> = {}): OrderPlan {
  return { request: REQUEST, contactStep: CONTACT, deliveryStep: DELIVERY, payment: 'mpesa', fulfilment: 'delivery', remember: null, ...over };
}

type Outcome = 'ok' | 'lost' | 'network' | 'timeout' | '500' | '429' | '403' | `400:${string}` | `shop400:${string}`;

/** A shop whose carts hold items at 100 each, whose order step can be scripted, and which remembers its orders. */
function makeShop(now: () => Date) {
  const carts = new Map<string, Map<string, number>>();
  const script: Outcome[] = [];
  const shop = {
    offline: false,
    /** What each item costs, which the shop can change without the phone being told. */
    price: 100,
    /** When a cart ends, for a cart that ends sooner than the others. */
    endsAt: new Map<string, string>(),
    created: 0,
    reads: 0,
    steps: [] as string[],
    submits: [] as Array<{ cartId: string; request: OrderRequestSent }>,
    orders: [] as Array<{ id: string; grandTotal: number; createdAt: string }>,
    contactFails: null as ShopApiError | null,
    deliveryFails: null as ShopApiError | null,
    onSubmit: null as null | (() => void),
    /** Runs just after the shop has answered a read of the cart. */
    afterRead: null as null | (() => void),
    script(...outcomes: Outcome[]) {
      script.push(...outcomes);
    },
    dropCart(cartId: string) {
      carts.delete(cartId);
    },
    cartApi: {
      async createCart(): Promise<ServerCart> {
        if (shop.offline) throw new ShopApiError('network', null, '');
        shop.created += 1;
        const id = `cart-${shop.created}`;
        carts.set(id, new Map());
        return view(id);
      },
      async setLine(cartId: string, change: Change): Promise<ServerCart> {
        if (shop.offline) throw new ShopApiError('network', null, '');
        const cart = carts.get(cartId);
        if (!cart) throw new ShopApiError('http', 404, 'Not found');
        if (change.quantity <= 0) cart.delete(change.itemId);
        else cart.set(change.itemId, change.quantity);
        return view(cartId);
      },
      async getCart(cartId: string): Promise<ServerCart> {
        shop.reads += 1;
        if (shop.offline) throw new ShopApiError('network', null, '');
        if (!carts.has(cartId)) throw new ShopApiError('http', 404, 'Cart not found or expired');
        const picture = view(cartId);
        shop.afterRead?.();
        return picture;
      },
    } satisfies CartApi,
    checkoutApi: {
      async saveContact(cartId: string) {
        shop.steps.push(`contact ${cartId}`);
        if (shop.contactFails) throw shop.contactFails;
        if (!carts.has(cartId)) throw new ShopApiError('http', 404, 'Not found');
      },
      async saveDelivery(cartId: string) {
        shop.steps.push(`delivery ${cartId}`);
        if (shop.deliveryFails) throw shop.deliveryFails;
        if (!carts.has(cartId)) throw new ShopApiError('http', 404, 'Not found');
      },
      async submit(cartId: string, request: OrderRequestSent): Promise<PlacedOrder> {
        shop.submits.push({ cartId, request });
        shop.onSubmit?.();
        const outcome = script.shift() ?? 'ok';
        if (outcome === 'network') throw new ShopApiError('network', null, '');
        if (outcome === 'timeout') throw new ShopApiError('timeout', null, '');
        if (outcome === '500') throw new ShopApiError('http', 500, '');
        if (outcome === '429') throw new ShopApiError('http', 429, ''); // a proxy limiting calls, not the shop
        if (outcome === '403') throw new ShopApiError('http', 403, ''); // a portal, not the shop
        if (outcome.startsWith('400:')) throw new ShopApiError('http', 400, outcome.slice(4));
        if (outcome.startsWith('shop400:')) throw new ShopApiError('http', 400, outcome.slice(8), true); // the shop's own refusal
        const cart = carts.get(cartId);
        if (!cart) throw new ShopApiError('http', 404, 'Not found');
        const grandTotal = [...cart.values()].reduce((sum, q) => sum + q * shop.price, 0);
        carts.delete(cartId);
        const order = { id: `order-${shop.orders.length + 1}`, grandTotal, createdAt: now().toISOString() };
        shop.orders.push(order);
        if (outcome === 'lost') throw new ShopApiError('timeout', null, '');
        return { orderId: order.id, orderCode: `PM-${order.id}`, grandTotal, currency: 'KES', createdAt: order.createdAt };
      },
    } satisfies CheckoutApi,
  };
  function view(id: string): ServerCart {
    const cart = carts.get(id)!;
    const lines = [...cart].map(([itemId, quantity]) => ({ itemId, name: itemId, quantity, unitPrice: shop.price, lineTotal: shop.price * quantity }));
    return { id, currency: 'KES', expiresAt: shop.endsAt.get(id) ?? '2026-12-30T00:00:00.000Z', subtotal: lines.reduce((s, l) => s + l.lineTotal, 0), lines };
  }
  return shop;
}

async function harness(
  options: {
    listOrders?: () => Promise<KnownOrder[]>;
    knownOrderIds?: () => Promise<ReadonlySet<string>>;
    failDoubtWrites?: boolean;
    startedWith?: DoubtRecord;
  } = {},
) {
  let nowMs = Date.UTC(2026, 10, 23, 9, 0, 0);
  const now = () => new Date(nowMs);
  const advance = (seconds: number) => {
    nowMs += seconds * 1000;
  };
  let saved: string | null = null;
  const storage: BasketStorage = { read: async () => saved, write: async (raw) => void (saved = raw) };
  const basket = createBasketStore(storage, now);
  await basket.settled();
  const shop = makeShop(now);
  const sync = createSyncRunner(basket, shop.cartApi, now);
  let note: DoubtRecord | null = options.startedWith ?? null;
  const doubt: DoubtStorage & { writes: Array<DoubtRecord | null>; linesKeptWhenCleared: number[] } = {
    writes: [],
    /** How many lines the saved basket had at each moment the note was cleared. */
    linesKeptWhenCleared: [],
    read: async () => note,
    write: async (record) => {
      if (options.failDoubtWrites) throw new Error('disk');
      if (record === null) doubt.linesKeptWhenCleared.push(saved ? (JSON.parse(saved).lines?.length ?? -1) : -1);
      doubt.writes.push(record);
      note = record;
    },
  };
  const runner = createCheckoutRunner({
    basket,
    syncNow: () => sync.run(),
    readShop: () => readFromShop(basket, shop.cartApi, now),
    api: shop.checkoutApi,
    doubt,
    now,
    listOrders: options.listOrders,
    knownOrderIds: options.knownOrderIds,
  });
  const fill = () =>
    basket.update((b) => setQuantity(setQuantity(b, { itemId: 'tea', name: 'Tea', unitPrice: 100 }, 2, now()), { itemId: 'milk', name: 'Milk', unitPrice: 100 }, 1, now()));
  return { basket, shop, sync, doubt, runner, fill, advance, now, note: () => note };
}

test('a basket the shop has priced is ordered through the shop\'s steps, in order, once, and nothing is left behind', async () => {
  const t = await harness();
  t.fill();
  const result = await t.runner.place(plan(), { confirmedTotal: 300 });
  assert.equal(result.kind, 'placed');
  assert.equal((result as { order: PlacedOrder }).order.grandTotal, 300);
  assert.deepEqual(t.shop.steps, ['contact cart-1', 'delivery cart-1']);
  assert.equal(t.shop.submits.length, 1);
  assert.deepEqual(t.shop.submits[0], { cartId: 'cart-1', request: REQUEST });
  assert.equal(t.note(), null);
  assert.deepEqual(t.basket.get().lines, []);
  assert.equal(t.basket.get().cartId, null);
  assert.equal(await t.runner.pending(), null);
});

test('nothing is sent while the shop has not heard the basket', async () => {
  const t = await harness();
  t.shop.offline = true;
  t.fill();
  const result = await t.runner.place(plan());
  assert.deepEqual(result, { kind: 'needs-basket', why: 'waiting' });
  assert.deepEqual(t.shop.steps, []);
  assert.deepEqual(t.shop.submits, []);
  assert.equal(t.basket.get().lines.length, 2, 'and the basket is as the shopper left it');
});

test('an empty basket is not an order', async () => {
  const t = await harness();
  assert.deepEqual(await t.runner.place(plan()), { kind: 'needs-basket', why: 'empty' });
  assert.deepEqual(t.shop.submits, []);
});

test('a line the shop refused stops the order before anything is sent', async () => {
  const t = await harness();
  t.fill();
  t.basket.update((b) => ({ ...b, refused: { tea: 'Only 1 available at this store' } }));
  assert.deepEqual(await t.runner.place(plan()), { kind: 'needs-basket', why: 'refused' });
  assert.deepEqual(t.shop.submits, []);
});

test('a total that is not the one on the shopper\'s screen is shown to them before the order goes', async () => {
  const t = await harness();
  t.fill();
  const result = await t.runner.place(plan(), { confirmedTotal: 250 });
  assert.deepEqual(result, { kind: 'total-changed', was: 250, now: 300 });
  assert.deepEqual(t.shop.steps, []);
  assert.deepEqual(t.shop.submits, []);
  assert.equal(await t.runner.pending(), null, 'nothing is in doubt: nothing was sent');
});

test('a contact step the shop refuses stops the order, in the shop\'s words, and leaves no note', async () => {
  const t = await harness();
  t.fill();
  t.shop.contactFails = new ShopApiError('http', 400, 'Invalid email');
  const result = await t.runner.place(plan());
  assert.equal(result.kind, 'refused');
  assert.equal((result as { step: string }).step, 'contact');
  assert.match((result as { message: string }).message, /does not look right/);
  assert.deepEqual(t.shop.steps, ['contact cart-1']);
  assert.deepEqual(t.shop.submits, []);
  assert.deepEqual(t.doubt.writes, []);
});

test('a delivery step the shop refuses, such as an area it does not serve, stops the order with its words', async () => {
  const t = await harness();
  t.fill();
  t.shop.deliveryFails = new ShopApiError('http', 400, 'we do not deliver to that area');
  const result = await t.runner.place(plan());
  assert.deepEqual(result, { kind: 'refused', step: 'delivery', message: 'We do not deliver to that area.' });
  assert.deepEqual(t.shop.submits, []);
});

test('a contact step that gets no answer does not stop the order, and the delivery step, which needs it, is left out', async () => {
  const t = await harness();
  t.fill();
  t.shop.contactFails = new ShopApiError('timeout', null, '');
  const result = await t.runner.place(plan());
  assert.equal(result.kind, 'placed');
  assert.deepEqual(t.shop.steps, ['contact cart-1']);
  assert.equal(t.shop.submits.length, 1);
});

test('a pickup has no steps and goes straight to the order', async () => {
  const t = await harness();
  t.fill();
  const result = await t.runner.place(plan({ contactStep: null, deliveryStep: null, fulfilment: 'pickup' }));
  assert.equal(result.kind, 'placed');
  assert.deepEqual(t.shop.steps, []);
});

test('what is about to be sent is written to the phone before it is sent', async () => {
  const t = await harness();
  t.fill();
  let seen: DoubtRecord | null = null;
  t.shop.onSubmit = () => {
    seen = t.note();
  };
  await t.runner.place(plan());
  assert.ok(seen, 'the note was there when the call went out');
  const record = seen as DoubtRecord;
  assert.equal(record.cartId, 'cart-1');
  assert.equal(record.attempts, 1);
  assert.equal(record.total, 300);
  assert.deepEqual(record.request, REQUEST);
});

test('no answer to the order leaves it in doubt, keeps the basket, and a second tap does not send it again', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('timeout');
  const first = await t.runner.place(plan());
  assert.equal(first.kind, 'in-doubt');
  const record = (first as { record: DoubtRecord }).record;
  assert.equal(record.cartId, 'cart-1');
  assert.equal(record.attempts, 1);
  assert.deepEqual(t.note(), record, 'kept on the phone');
  assert.equal(t.basket.get().lines.length, 2, 'the basket stays until the shopper settles it');
  const second = await t.runner.place(plan());
  assert.equal(second.kind, 'in-doubt');
  assert.equal(t.shop.submits.length, 1, 'the shop was asked once');
});

test('a server fault is in doubt too', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('500');
  assert.equal((await t.runner.place(plan())).kind, 'in-doubt');
  assert.equal(t.shop.submits.length, 1);
});

test('an order in doubt from before blocks a new one, and nothing is sent', async () => {
  const earlier: DoubtRecord = {
    cartId: 'cart-9', startedAt: '2026-11-23T08:00:00.000Z', lastTriedAt: '2026-11-23T08:00:00.000Z', attempts: 1, total: 300, currency: 'KES', request: REQUEST,
  };
  const t = await harness({ startedWith: earlier });
  t.fill();
  const result = await t.runner.place(plan());
  assert.deepEqual(result, { kind: 'in-doubt', record: earlier });
  assert.deepEqual(t.shop.submits, []);
  assert.deepEqual(t.shop.steps, []);
});

test('a refusal of the order clears the note and keeps the basket, with the shop\'s cart', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('400:Insufficient stock for one or more items (only 1 left at this store for an item in your cart)');
  const result = await t.runner.place(plan());
  assert.equal(result.kind, 'refused');
  assert.equal((result as { step: string }).step, 'order');
  assert.match((result as { message: string }).message, /Only 1 left at this store/);
  assert.equal(t.note(), null);
  assert.equal(t.basket.get().lines.length, 2);
  assert.equal(t.basket.get().cartId, 'cart-1');
});

test('a cart the shop no longer has is found out when the shop is asked, and the lines go to a new cart before the order', async () => {
  const t = await harness();
  t.fill();
  await t.sync.run();
  t.shop.dropCart('cart-1');
  const result = await t.runner.place(plan());
  assert.equal(result.kind, 'placed');
  assert.equal(t.shop.created, 2);
  assert.deepEqual(t.shop.steps, ['contact cart-2', 'delivery cart-2']);
  assert.equal(t.shop.submits.length, 1, 'the order went once, to the new cart');
  assert.equal(t.shop.submits[0].cartId, 'cart-2');
  assert.equal(t.note(), null);
});

test('a cart that goes while the order is being made was not ordered: the lines are kept to be put in a new one', async () => {
  const t = await harness();
  t.fill();
  await t.sync.run();
  t.shop.afterRead = () => t.shop.dropCart('cart-1'); // gone just after the shop said it was there
  const result = await t.runner.place(plan());
  assert.deepEqual(result, { kind: 'basket-lapsed' });
  assert.equal(t.note(), null);
  assert.equal(t.basket.get().cartId, null);
  assert.equal(t.basket.get().lines.length, 2);
  t.shop.afterRead = null;
  const again = await t.runner.place(plan());
  assert.equal(again.kind, 'placed', 'and the next try builds a cart and orders from it');
  assert.equal(t.shop.submits.at(-1)?.cartId, 'cart-2');
});

test('a cart close to lapsing is put in a new one first, and the order goes to that', async () => {
  const t = await harness();
  t.fill();
  await t.sync.run();
  t.shop.endsAt.set('cart-1', new Date(t.now().getTime() + 30_000).toISOString()); // what the shop says when it is asked
  const result = await t.runner.place(plan());
  assert.equal(result.kind, 'placed');
  assert.equal(t.shop.created, 2);
  assert.deepEqual(t.shop.steps, ['contact cart-2', 'delivery cart-2']);
  assert.equal(t.shop.submits[0].cartId, 'cart-2');
});

test('asking again too soon is told to wait; after that the same order goes to the same cart, unchanged', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('timeout');
  await t.runner.place(plan());
  const soon = await t.runner.checkAgain();
  assert.deepEqual(soon, { kind: 'too-soon', waitMs: IN_DOUBT_MIN_GAP_MS });
  assert.equal(t.shop.submits.length, 1);
  t.advance(IN_DOUBT_MIN_GAP_MS / 1000);
  const later = await t.runner.checkAgain();
  assert.equal(later.kind, 'placed', 'the first call never got to the shop, so this one places it');
  assert.equal(t.shop.submits.length, 2);
  assert.deepEqual(t.shop.submits[1], t.shop.submits[0], 'the same cart and the same words');
  assert.equal(t.shop.orders.length, 1, 'one order at the shop');
  assert.equal(t.note(), null);
  assert.deepEqual(t.basket.get().lines, []);
});

test('when the first call did reach the shop, asking again finds no basket and says the order was probably placed', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('lost');
  assert.equal((await t.runner.place(plan())).kind, 'in-doubt');
  t.advance(IN_DOUBT_MIN_GAP_MS / 1000);
  const second = await t.runner.checkAgain();
  assert.equal(second.kind, 'probably-placed');
  assert.equal((second as { record: DoubtRecord }).record.attempts, 2);
  assert.equal(t.shop.orders.length, 1, 'still one order at the shop');
  assert.notEqual(t.note(), null, 'it stays until the shopper says what happened');
  assert.equal(t.basket.get().lines.length, 2, 'and so does the basket');
});

test('the shopper saying it was placed empties the basket and clears the note', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('lost');
  await t.runner.place(plan());
  await t.runner.settle('placed');
  assert.equal(t.note(), null);
  assert.deepEqual(t.basket.get().lines, []);
  assert.equal(t.basket.get().cartId, null);
});

test('the shopper saying it was not placed clears the note and keeps the lines, in a new cart', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('lost');
  await t.runner.place(plan());
  await t.runner.settle('not-placed');
  assert.equal(t.note(), null);
  assert.equal(t.basket.get().lines.length, 2);
  assert.equal(t.basket.get().cartId, null);
  const result = await t.runner.place(plan());
  assert.equal(result.kind, 'placed');
  assert.equal(t.shop.submits.at(-1)?.cartId, 'cart-2');
});

test('a lost answer is recognised from the shopper\'s own orders, and nothing is sent again', async () => {
  let orders: KnownOrder[] = [];
  const t = await harness({ listOrders: async () => orders });
  t.fill();
  t.shop.script('lost');
  await t.runner.place(plan());
  orders = t.shop.orders.map((o) => ({ id: o.id, orderCode: 'AB12CD34', grandTotal: o.grandTotal, createdAt: o.createdAt }));
  const found = await t.runner.checkAgain();
  assert.equal(found.kind, 'placed');
  assert.equal((found as { order: PlacedOrder }).order.orderId, 'order-1');
  assert.equal((found as { order: PlacedOrder }).order.orderCode, 'AB12CD34', 'the shop\'s code for it is kept for the receipt');
  assert.equal(t.shop.submits.length, 1);
  assert.equal(t.note(), null);
  assert.deepEqual(t.basket.get().lines, []);
});

test('an order recognised from a list that gives no code is placed with no code, not a made-up one', async () => {
  let orders: KnownOrder[] = [];
  const t = await harness({ listOrders: async () => orders });
  t.fill();
  t.shop.script('lost');
  await t.runner.place(plan());
  orders = t.shop.orders.map((o) => ({ id: o.id, grandTotal: o.grandTotal, createdAt: o.createdAt }));
  const found = await t.runner.checkAgain();
  assert.equal(found.kind, 'placed');
  assert.equal('orderCode' in (found as { order: PlacedOrder }).order, false);
});

test('not being able to look at the shopper\'s orders is not an answer: the wait and the resend apply', async () => {
  const t = await harness({
    listOrders: async () => {
      throw new ShopApiError('network', null, '');
    },
  });
  t.fill();
  t.shop.script('timeout');
  await t.runner.place(plan());
  assert.equal((await t.runner.checkAgain()).kind, 'too-soon');
  t.advance(IN_DOUBT_MIN_GAP_MS / 1000);
  assert.equal((await t.runner.checkAgain()).kind, 'placed');
});

test('the shop\'s prices as they are now are what the shopper is asked to confirm, not the prices it last gave', async () => {
  const t = await harness();
  t.fill();
  await t.sync.run();
  t.shop.price = 120; // the shop raised its prices after it last answered the phone
  const result = await t.runner.place(plan(), { confirmedTotal: 300 });
  assert.deepEqual(result, { kind: 'total-changed', was: 300, now: 360 });
  assert.deepEqual(t.shop.steps, []);
  assert.deepEqual(t.shop.submits, []);
  assert.equal(t.note(), null, 'nothing was sent, so nothing is in doubt');
  const again = await t.runner.place(plan(), { confirmedTotal: 360 });
  assert.equal(again.kind, 'placed');
  assert.equal((again as { order: PlacedOrder }).order.grandTotal, 360);
});

test('a shop that cannot be reached when the basket is checked is sent no order, and nothing is in doubt', async () => {
  const t = await harness();
  t.fill();
  await t.sync.run();
  t.shop.offline = true;
  const result = await t.runner.place(plan());
  assert.deepEqual(result, { kind: 'needs-basket', why: 'unreachable' });
  assert.deepEqual(t.shop.steps, []);
  assert.deepEqual(t.shop.submits, []);
  assert.deepEqual(t.doubt.writes, [], 'no note was written: nothing was sent');
  assert.equal(await t.runner.pending(), null);
  assert.equal(t.basket.get().lines.length, 2, 'and the basket is as it was');
  t.shop.offline = false;
  assert.equal((await t.runner.place(plan())).kind, 'placed', 'the next tap, with a signal, goes through');
});

test('the shop is asked for its cart once for an order, after it has heard the basket', async () => {
  const t = await harness();
  t.fill();
  assert.equal((await t.runner.place(plan())).kind, 'placed');
  assert.equal(t.shop.reads, 1);
  assert.equal(t.shop.created, 1);
});

test('an order this phone already heard about is not the one whose answer was lost', async () => {
  const known = new Set<string>();
  let listed: KnownOrder[] = [];
  const t = await harness({ listOrders: async () => listed, knownOrderIds: async () => known });
  t.fill();
  const first = await t.runner.place(plan());
  assert.equal(first.kind, 'placed');
  known.add((first as { order: PlacedOrder }).order.orderId);
  t.advance(60);
  t.fill(); // the same basket again, a minute later
  t.shop.script('timeout'); // and this order never reaches the shop
  assert.equal((await t.runner.place(plan())).kind, 'in-doubt');
  listed = t.shop.orders.map((o) => ({ id: o.id, grandTotal: o.grandTotal, createdAt: o.createdAt }));
  assert.equal(t.shop.orders.length, 1, 'only the first was ever placed');
  assert.deepEqual(await t.runner.checkAgain(), { kind: 'too-soon', waitMs: IN_DOUBT_MIN_GAP_MS }, 'the first is not taken for it');
  t.advance(IN_DOUBT_MIN_GAP_MS / 1000);
  assert.equal((await t.runner.checkAgain()).kind, 'placed');
  assert.equal(t.shop.orders.length, 2, 'it is placed now, once');
});

test('not being able to say which orders are known does not stop a placed one from being recognised', async () => {
  let orders: KnownOrder[] = [];
  const t = await harness({
    listOrders: async () => orders,
    knownOrderIds: async () => {
      throw new Error('disk');
    },
  });
  t.fill();
  t.shop.script('lost');
  await t.runner.place(plan());
  orders = t.shop.orders.map((o) => ({ id: o.id, grandTotal: o.grandTotal, createdAt: o.createdAt }));
  const found = await t.runner.checkAgain();
  assert.equal(found.kind, 'placed');
  assert.equal(t.shop.submits.length, 1, 'nothing was sent again');
});

test('a repeat of an order that went through is not refused by a proxy, so the note stays and a second order is not made', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('lost'); // the order is placed, and the answer is lost
  const first = await t.runner.place(plan());
  assert.equal(first.kind, 'in-doubt');
  assert.equal(t.shop.orders.length, 1);
  t.advance(IN_DOUBT_MIN_GAP_MS / 1000);
  t.shop.script('429'); // the repeat is answered by something in between
  const second = await t.runner.checkAgain();
  assert.equal(second.kind, 'in-doubt', 'a limit that is not the shop\'s says nothing about the first call');
  assert.equal((second as { record: DoubtRecord }).record.attempts, 2);
  assert.notEqual(t.note(), null, 'the note is kept');
  assert.equal(t.basket.get().lines.length, 2, 'and so is the basket');
  assert.equal((await t.runner.place(plan())).kind, 'in-doubt', 'a new order is still not sent');
  t.advance(IN_DOUBT_MIN_GAP_MS / 1000);
  t.shop.script('403');
  assert.equal((await t.runner.checkAgain()).kind, 'in-doubt', 'nor by a portal');
  t.advance(IN_DOUBT_MIN_GAP_MS / 1000);
  const third = await t.runner.checkAgain();
  assert.equal(third.kind, 'probably-placed', 'the shop itself says there is no such cart');
  assert.equal(t.shop.orders.length, 1, 'one order at the shop, throughout');
});

test('a repeat of an order that did not go through is refused by the shop in its own words, and nothing was placed', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('timeout'); // the first call never reached the shop
  assert.equal((await t.runner.place(plan())).kind, 'in-doubt');
  t.advance(IN_DOUBT_MIN_GAP_MS / 1000);
  t.shop.script('shop400:Insufficient stock for one or more items (only 1 left at this store for an item in your cart)');
  const result = await t.runner.checkAgain();
  assert.equal(result.kind, 'refused');
  assert.match((result as { message: string }).message, /Only 1 left/);
  assert.equal(t.note(), null, 'the shop looked at the cart and said no, so nothing is in doubt');
  assert.equal(t.shop.orders.length, 0);
  assert.equal(t.basket.get().lines.length, 2);
});

test('a first order that the shop refuses is refused whatever answered, as before', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('429');
  const result = await t.runner.place(plan());
  assert.equal(result.kind, 'refused');
  assert.match((result as { message: string }).message, /Too many tries/);
  assert.equal(t.note(), null);
});

test('an item the shop no longer sells lets go of its cart, so the lines are told to a new one, and the cart is not kept for ever', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('400:Item no longer available');
  const result = await t.runner.place(plan());
  assert.equal(result.kind, 'refused');
  assert.match((result as { message: string }).message, /no longer sold/);
  assert.equal(t.note(), null);
  assert.equal(t.basket.get().cartId, null, 'the cart that holds a row the shopper cannot see is let go');
  assert.equal(t.basket.get().lines.length, 2, 'the lines are kept');
  const again = await t.runner.place(plan());
  assert.equal(again.kind, 'placed');
  assert.equal(t.shop.submits.at(-1)?.cartId, 'cart-2', 'in a new cart');
});

test('a refusal about stock keeps the cart, since the lines the shopper sees are the lines the shop holds', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('400:Insufficient stock for one or more items (only 1 left at this store for an item in your cart)');
  assert.equal((await t.runner.place(plan())).kind, 'refused');
  assert.equal(t.basket.get().cartId, 'cart-1');
});

test('a step refused for who is asking or for how often, not for the details, does not stop the order', async () => {
  for (const status of [401, 403, 404, 407, 408, 429]) {
    const t = await harness();
    t.fill();
    t.shop.contactFails = new ShopApiError('http', status, '');
    const result = await t.runner.place(plan());
    assert.equal(result.kind, 'placed', `contact ${status}`);
    const u = await harness();
    u.fill();
    u.shop.deliveryFails = new ShopApiError('http', status, '');
    assert.equal((await u.runner.place(plan())).kind, 'placed', `delivery ${status}`);
  }
});

test('the basket is emptied and written before the note is cleared, so a phone that stops between them does not order twice', async () => {
  const placed = await harness();
  placed.fill();
  assert.equal((await placed.runner.place(plan())).kind, 'placed');
  assert.deepEqual(placed.doubt.linesKeptWhenCleared, [0], 'placed');

  let orders: KnownOrder[] = [];
  const found = await harness({ listOrders: async () => orders });
  found.fill();
  found.shop.script('lost');
  await found.runner.place(plan());
  orders = found.shop.orders.map((o) => ({ id: o.id, grandTotal: o.grandTotal, createdAt: o.createdAt }));
  assert.equal((await found.runner.checkAgain()).kind, 'placed');
  assert.deepEqual(found.doubt.linesKeptWhenCleared, [0], 'recognised at the shop');

  const said = await harness();
  said.fill();
  said.shop.script('lost');
  await said.runner.place(plan());
  await said.runner.settle('placed');
  assert.deepEqual(said.doubt.linesKeptWhenCleared, [0], 'said to be placed');
});

test('with nothing in doubt there is nothing to check', async () => {
  const t = await harness();
  assert.deepEqual(await t.runner.checkAgain(), { kind: 'nothing-pending' });
});

test('two taps at once send one order, and the second is told it did nothing', async () => {
  const t = await harness();
  t.fill();
  const first = t.runner.place(plan());
  const second = t.runner.place(plan());
  assert.deepEqual(await second, { kind: 'busy' });
  assert.equal((await first).kind, 'placed');
  assert.equal(t.shop.submits.length, 1);
  assert.equal(t.runner.isBusy(), false);
});

test('an order is not held up by a note that cannot be written', async () => {
  const t = await harness({ failDoubtWrites: true });
  t.fill();
  const result = await t.runner.place(plan());
  assert.equal(result.kind, 'placed');
});

test('a cart that still looks lapsed in a new cart is said to be lapsed, not "waiting", and nothing is sent', async () => {
  const t = await harness();
  t.fill();
  t.advance(60 * 24 * 60 * 60); // the phone's clock is long past when the shop's carts end
  const result = await t.runner.place(plan());
  assert.deepEqual(result, { kind: 'needs-basket', why: 'lapsed' });
  assert.deepEqual(t.shop.submits, []);
  assert.equal(t.shop.created, 2, 'one new cart was tried, no more');
  assert.equal(t.shop.reads, 1, 'and the shop was asked for its cart once, not again for the new one');
});

test('a total a shilling different is shown to the shopper first, and one the same to the cent is not', async () => {
  const t = await harness();
  t.fill();
  assert.deepEqual(await t.runner.place(plan(), { confirmedTotal: 299 }), { kind: 'total-changed', was: 299, now: 300 });
  assert.equal((await t.runner.place(plan(), { confirmedTotal: 300.001 })).kind, 'placed');
});

test('an order in doubt keeps the time the answer failed to come, and the wait is counted from that', async () => {
  const t = await harness();
  t.fill();
  t.shop.onSubmit = () => t.advance(12); // the call takes twelve seconds to fail
  t.shop.script('timeout');
  const first = await t.runner.place(plan());
  assert.equal(first.kind, 'in-doubt');
  const record = (first as { record: DoubtRecord }).record;
  assert.equal(Date.parse(record.lastTriedAt) - Date.parse(record.startedAt), 12_000);
  assert.deepEqual(t.note(), record, 'and that is what is kept on the phone');
  t.shop.onSubmit = null;
  t.advance(8); // twenty seconds from the send, but only eight from the failure
  assert.equal((await t.runner.checkAgain()).kind, 'too-soon');
});

test('a note that cannot be read is no note, when looking for one', async () => {
  const t = await harness();
  t.doubt.read = async () => {
    throw new Error('disk');
  };
  assert.equal(await t.runner.pending(), null);
});

test('the same order is sent again to the same cart, even if the basket has since been moved to another', async () => {
  const t = await harness();
  t.fill();
  t.shop.script('timeout');
  await t.runner.place(plan());
  t.basket.update((b) => ({ ...b, cartId: 'cart-elsewhere' }));
  t.advance(IN_DOUBT_MIN_GAP_MS / 1000);
  await t.runner.checkAgain();
  assert.equal(t.shop.submits.length, 2);
  assert.equal(t.shop.submits[1].cartId, 'cart-1');
});
