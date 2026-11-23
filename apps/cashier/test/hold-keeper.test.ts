import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addUnit, type CartItem } from '../src/lib/cart';
import { createHoldKeeper, type HoldStorage } from '../src/lib/hold-keeper';
import { emptyBook, holdCart, serializeHoldBook, type HoldBook, type Holder } from '../src/lib/holds';

const MILK: CartItem = { id: 'i-milk', name: 'Milk 500ml', sellingPrice: 65 };
const WHO: Holder = { branchId: 'b-1', userId: 'u-1' };
const NOON = Date.parse('2026-11-23T12:00:00.000Z');

function bookWith(...ids: string[]): HoldBook {
  let book = emptyBook();
  for (const id of ids) {
    const result = holdCart(book, addUnit([], MILK) ?? [], WHO, NOON, id);
    if (result.ok) book = result.book;
  }
  return book;
}

function memory(initial: string | null = null) {
  const written: string[] = [];
  let stored = initial;
  const storage: HoldStorage = {
    read: async () => stored,
    write: async (value) => {
      written.push(value);
      stored = value;
      return true;
    },
  };
  return { storage, written, stored: () => stored };
}

test('the baskets on the phone are read back', async () => {
  const book = bookWith('h-1', 'h-2');
  const { storage } = memory(serializeHoldBook(book));
  const parsed = await createHoldKeeper(storage).load(NOON);
  assert.deepEqual(parsed.book.baskets.map((b) => b.id).sort(), ['h-1', 'h-2']);
});

test('nothing on the phone is no baskets', async () => {
  const parsed = await createHoldKeeper(memory(null).storage).load(NOON);
  assert.deepEqual(parsed.book.baskets, []);
});

test('a phone that cannot be read is not "no baskets": the load fails, so nothing is saved over what is there', async () => {
  const storage: HoldStorage = {
    read: async () => {
      throw new Error('disk error');
    },
    write: async () => true,
  };
  await assert.rejects(() => createHoldKeeper(storage).load(NOON), /disk error/);
});

test('a saved book is what is read next time', async () => {
  const { storage } = memory();
  const keeper = createHoldKeeper(storage);
  assert.equal(await keeper.save(bookWith('h-1')), true);
  assert.deepEqual((await keeper.load(NOON)).book.baskets.map((b) => b.id), ['h-1']);
});

test('saves never overlap, and the last one asked for is the last one written', async () => {
  const written: string[] = [];
  let inFlight = 0;
  let overlapped = false;
  const storage: HoldStorage = {
    read: async () => null,
    write: async (value) => {
      inFlight += 1;
      if (inFlight > 1) overlapped = true;
      await new Promise((resolve) => setTimeout(resolve, 15));
      written.push(value);
      inFlight -= 1;
      return true;
    },
  };
  const keeper = createHoldKeeper(storage);
  const asked = [keeper.save(bookWith('h-1')), keeper.save(bookWith('h-1', 'h-2')), keeper.save(bookWith('h-3'))];
  assert.deepEqual(await Promise.all(asked), [true, true, true]);
  assert.equal(overlapped, false);
  assert.equal(written.at(-1), serializeHoldBook(bookWith('h-3')), 'the last book asked for is the one on the phone');
  assert.ok(written.length <= 2, 'saves asked for while one was running are folded into one');
});

test('a write that fails is reported, and the next save still works', async () => {
  let fail = true;
  const written: string[] = [];
  const storage: HoldStorage = {
    read: async () => null,
    write: async (value) => {
      if (fail) throw new Error('disk full');
      written.push(value);
      return true;
    },
  };
  const keeper = createHoldKeeper(storage);
  assert.equal(await keeper.save(bookWith('h-1')), false);
  fail = false;
  assert.equal(await keeper.save(bookWith('h-2')), true);
  assert.deepEqual(written, [serializeHoldBook(bookWith('h-2'))]);
});

test('a shop that owns no data cannot keep baskets, and says so', async () => {
  const storage: HoldStorage = { read: async () => null, write: async () => false };
  assert.equal(await createHoldKeeper(storage).save(bookWith('h-1')), false);
});

test('saving after a failed save writes the latest book, not the one that failed', async () => {
  const calls: string[] = [];
  let first = true;
  const storage: HoldStorage = {
    read: async () => null,
    write: async (value) => {
      calls.push(value);
      if (first) {
        first = false;
        throw new Error('once');
      }
      return true;
    },
  };
  const keeper = createHoldKeeper(storage);
  const a = keeper.save(bookWith('h-1'));
  const b = keeper.save(bookWith('h-1', 'h-2'));
  assert.equal(await a, await b, 'one run answers for both');
  assert.equal(calls.at(-1), serializeHoldBook(bookWith('h-1', 'h-2')));
});

test('what a save answers is whether the LAST write landed, whatever became of the one before it', async () => {
  const failures: Array<() => void> = [];
  let calls = 0;
  const storage: HoldStorage = {
    read: async () => null,
    write: () => {
      calls += 1;
      if (calls === 1) return new Promise<boolean>((_resolve, reject) => failures.push(() => reject(new Error('disk full'))));
      return Promise.resolve(true);
    },
  };
  const keeper = createHoldKeeper(storage);
  const first = keeper.save(bookWith('h-1'));
  const second = keeper.save(bookWith('h-1', 'h-2'));
  failures[0]?.();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(calls, 2);
});
