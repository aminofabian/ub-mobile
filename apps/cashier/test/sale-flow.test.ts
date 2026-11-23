import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import {
  SALE_SEND_TIMEOUT_MS,
  SaleTimedOut,
  buildSaleBody,
  createKeyKeeper,
  describeSaleRefusal,
  isSaleRefusal,
  saveThenSend,
} from '../src/lib/sale-flow';

const CART = [
  { itemId: 'i-1', quantity: 2, unitPrice: 120 },
  { itemId: 'i-2', quantity: 1, unitPrice: 49.5 },
];
const SOLD_AT = new Date('2026-11-23T10:15:00.000Z');

test('the sale request carries the lines, the payments and the time, and only those', () => {
  const body = buildSaleBody({
    branchId: 'b-1',
    cart: [{ ...CART[0], name: 'Maize flour 2kg', extra: 'not sent' } as never, CART[1]],
    payments: [{ method: 'cash', amount: 289.5 }],
    soldAt: SOLD_AT,
  });
  assert.deepEqual(body, {
    branchId: 'b-1',
    lines: [
      { itemId: 'i-1', quantity: 2, unitPrice: 120 },
      { itemId: 'i-2', quantity: 1, unitPrice: 49.5 },
    ],
    payments: [{ method: 'cash', amount: 289.5 }],
    clientSoldAt: '2026-11-23T10:15:00.000Z',
  });
  assert.equal('customerId' in body, false);
  assert.equal('cashReceived' in body, false);
});

test('a customer and the notes handed over are added only when there are some', () => {
  const body = buildSaleBody({
    branchId: 'b-1',
    cart: CART,
    payments: [{ method: 'cash', amount: 289.5 }],
    cashReceived: 500,
    customerId: 'c-9',
    soldAt: SOLD_AT,
  });
  assert.equal(body.customerId, 'c-9');
  assert.equal(body.cashReceived, 500);
  for (const customerId of [null, undefined, '']) {
    assert.equal('customerId' in buildSaleBody({ branchId: 'b', cart: CART, payments: [], customerId, soldAt: SOLD_AT }), false);
  }
  // Notes of zero are still notes that were recorded.
  assert.equal(buildSaleBody({ branchId: 'b', cart: CART, payments: [], cashReceived: 0, soldAt: SOLD_AT }).cashReceived, 0);
});

test('the same sale is always sent under the same key, however often it is tried', () => {
  let minted = 0;
  const keyFor = createKeyKeeper(() => `key-${++minted}`);
  const sale = (soldAt: Date) =>
    buildSaleBody({ branchId: 'b-1', cart: CART, payments: [{ method: 'cash', amount: 289.5 }], soldAt });
  const first = keyFor(sale(SOLD_AT));
  // A second tap a moment later is the same sale, even though the clock has moved.
  assert.equal(keyFor(sale(new Date(SOLD_AT.getTime() + 5000))), first);
  assert.equal(keyFor(sale(SOLD_AT)), first);
  assert.equal(minted, 1);
});

test('the notes handed over only work out the change, so they do not make a sale a different sale', () => {
  let minted = 0;
  const keyFor = createKeyKeeper(() => `key-${++minted}`);
  const base = { branchId: 'b-1', cart: CART, payments: [{ method: 'cash' as const, amount: 289.5 }], soldAt: SOLD_AT };
  const first = keyFor(buildSaleBody(base));
  assert.equal(keyFor(buildSaleBody({ ...base, cashReceived: 500 })), first);
  assert.equal(keyFor(buildSaleBody({ ...base, cashReceived: 1000 })), first);
  assert.equal(minted, 1);
});

test('a sale that has changed in any way is a new sale with a new key', () => {
  const base = { branchId: 'b-1', cart: CART, payments: [{ method: 'cash' as const, amount: 289.5 }], soldAt: SOLD_AT };
  const changes = [
    { ...base, branchId: 'b-2' },
    { ...base, customerId: 'c-1' },
    { ...base, cart: [CART[0]] },
    { ...base, cart: [{ ...CART[0], quantity: 3 }, CART[1]] },
    { ...base, cart: [{ ...CART[0], unitPrice: 121 }, CART[1]] },
    { ...base, payments: [{ method: 'cash' as const, amount: 290 }] },
    { ...base, payments: [{ method: 'mpesa_manual' as const, amount: 289.5, reference: 'SHK7Y2ABCD' }] },
  ];
  for (const change of changes) {
    // Each change is set against the sale it was changed from, not against whatever happened to be sent just before it.
    let minted = 0;
    const keyFor = createKeyKeeper(() => `key-${++minted}`);
    const before = keyFor(buildSaleBody(base));
    const after = keyFor(buildSaleBody(change));
    assert.notEqual(after, before, JSON.stringify(change));
    assert.equal(keyFor(buildSaleBody(change)), after, 'and the changed sale keeps the key it was given');
  }
  // The same basket for two different customers is two different sales.
  let minted = 0;
  const keyFor = createKeyKeeper(() => `key-${++minted}`);
  const one = keyFor(buildSaleBody({ ...base, customerId: 'c-1' }));
  assert.notEqual(keyFor(buildSaleBody({ ...base, customerId: 'c-2' })), one);
});

test('the time the till waits for the server is twenty seconds', () => {
  assert.equal(SALE_SEND_TIMEOUT_MS, 20_000);
});

function recorder() {
  const events: string[] = [];
  return {
    events,
    save: async () => void events.push('save'),
    send: async () => {
      events.push('send');
      return { id: 'sale-1' };
    },
    forget: async () => void events.push('forget'),
  };
}

test('a sale is saved on the phone before it is sent, and forgotten once the server has it', async () => {
  const r = recorder();
  const result = await saveThenSend(r);
  assert.deepEqual(result, { kind: 'sent', sale: { id: 'sale-1' } });
  assert.deepEqual(r.events, ['save', 'send', 'forget']);
});

test('the server is not asked until the phone has its own copy', async () => {
  const order: string[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const pending = saveThenSend({
    save: async () => {
      order.push('saving');
      await gate;
      order.push('saved');
    },
    send: async () => {
      order.push('send');
      return 1;
    },
    forget: async () => undefined,
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(order, ['saving']);
  release();
  await pending;
  assert.deepEqual(order, ['saving', 'saved', 'send']);
});

test('a sale the server cannot take stays saved, and says why', async () => {
  const r = recorder();
  const failure = new TypeError('Network request failed');
  const result = await saveThenSend({ ...r, send: async () => { throw failure; } });
  assert.deepEqual(result, { kind: 'saved', error: failure });
  assert.equal(r.events.includes('forget'), false, 'a sale the server does not have is not forgotten');
});

test('a server that does not answer in time leaves the sale saved, and its late answer changes nothing', async () => {
  const r = recorder();
  let lateAnswer: (sale: { id: string }) => void = () => undefined;
  const result = await saveThenSend({
    ...r,
    send: () => new Promise((resolve) => (lateAnswer = resolve)),
    timeoutMs: 20,
  });
  assert.equal(result.kind, 'saved');
  assert.ok(result.kind === 'saved' && result.error instanceof SaleTimedOut);
  lateAnswer({ id: 'late' });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(r.events, ['save'], 'nothing was forgotten by the late answer');
});

test('a late failure after the time is up is not an unhandled rejection', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    let lateFailure: (error: Error) => void = () => undefined;
    const result = await saveThenSend({
      save: async () => undefined,
      send: () => new Promise((_resolve, reject) => (lateFailure = reject)),
      forget: async () => undefined,
      timeoutMs: 10,
    });
    assert.equal(result.kind, 'saved');
    lateFailure(new Error('too late'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('when the phone cannot save the sale it still tries the server, and a sale that got through is sent', async () => {
  const events: string[] = [];
  const result = await saveThenSend({
    save: async () => {
      throw new Error('storage is full');
    },
    send: async () => {
      events.push('send');
      return { id: 'sale-2' };
    },
    forget: async () => void events.push('forget'),
  });
  assert.deepEqual(result, { kind: 'sent', sale: { id: 'sale-2' } });
  assert.deepEqual(events, ['send'], 'there was nothing saved to forget');
});

test('a sale that could be neither saved nor sent is lost, which the screen must not hide', async () => {
  const failure = new TypeError('Network request failed');
  const result = await saveThenSend({
    save: async () => {
      throw new Error('storage is full');
    },
    send: async () => {
      throw failure;
    },
    forget: async () => undefined,
  });
  assert.deepEqual(result, { kind: 'lost', error: failure });
});

test('a sale the server took is sent even when the phone cannot tidy its own copy', async () => {
  const result = await saveThenSend({
    save: async () => undefined,
    send: async () => ({ id: 'sale-3' }),
    forget: async () => {
      throw new Error('storage is full');
    },
  });
  assert.deepEqual(result, { kind: 'sent', sale: { id: 'sale-3' } });
});

const server = (status: number, message = 'whatever the server said') => new ApiError(message, { status });
const setup = new ApiError('x', { status: 403, code: 'setup_required', requirement: 'shift' });

test('the server turning a sale down for what is in it is a refusal, and nothing that may come right later is', () => {
  for (const error of [server(400), server(403), server(404), server(422), server(402)]) {
    assert.equal(isSaleRefusal(error), true, String((error as ApiError).status));
  }
  for (const error of [
    server(401),
    server(408),
    server(409),
    server(423),
    server(429),
    server(500),
    server(502),
    server(503),
    setup,
    new TypeError('Network request failed'),
    new SaleTimedOut(),
    new Error('anything'),
    null,
  ]) {
    assert.equal(isSaleRefusal(error), false, String(error));
  }
});

test('a refused sale is not kept, and the cart is left for the cashier to fix', async () => {
  const r = recorder();
  const refusal = server(400, 'Payments must cover the amount due');
  const result = await saveThenSend({ ...r, send: async () => { throw refusal; } });
  assert.deepEqual(result, { kind: 'refused', error: refusal });
  assert.deepEqual(r.events, ['save', 'forget'], 'the saved copy is taken out again');
});

test('a refusal when the sale could not be saved needs nothing taken out', async () => {
  const events: string[] = [];
  const refusal = server(422);
  const result = await saveThenSend({
    save: async () => { throw new Error('storage is full'); },
    send: async () => { throw refusal; },
    forget: async () => void events.push('forget'),
  });
  assert.deepEqual(result, { kind: 'refused', error: refusal });
  assert.deepEqual(events, []);
});

test('a refusal is still a refusal when the saved copy cannot be taken out', async () => {
  const refusal = server(400);
  const result = await saveThenSend({
    save: async () => undefined,
    send: async () => { throw refusal; },
    forget: async () => { throw new Error('storage is full'); },
  });
  assert.deepEqual(result, { kind: 'refused', error: refusal });
});

test('everything else that goes wrong keeps the sale', async () => {
  for (const failure of [server(409), server(423), server(429), server(500), server(503), setup, new TypeError('Network request failed')]) {
    const r = recorder();
    const result = await saveThenSend({ ...r, send: async () => { throw failure; } });
    assert.deepEqual(result, { kind: 'saved', error: failure });
    assert.equal(r.events.includes('forget'), false);
  }
});

test('what the cashier is told about a refusal says what the server said, and what to do', () => {
  assert.equal(
    describeSaleRefusal(server(400, 'Payments must cover the amount due')),
    'The server did not accept this sale: Payments must cover the amount due. Nothing was recorded. Check the payment and try again.'
  );
  assert.equal(
    describeSaleRefusal(server(400, 'Customer is over the credit limit.')),
    'The server did not accept this sale: Customer is over the credit limit. Nothing was recorded. Check the payment and try again.'
  );
  assert.equal(
    describeSaleRefusal(new Error('boom')),
    'The server did not accept this sale. Nothing was recorded. Check the payment and try again.'
  );
});

test('a refusal after the customer paid by M-Pesa never says to send another prompt', () => {
  const text = describeSaleRefusal(server(400, 'M-Pesa code not found'), { mpesaPaid: true });
  assert.match(text, /M-Pesa code not found/);
  assert.match(text, /already paid by M-Pesa, so do not send another prompt\. Ask your manager\.$/);
  assert.doesNotMatch(text, /try again/i);
});
