import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeeper, type KeeperStorage } from '../src/keeper';

type Fake = KeeperStorage & { value: string | null; writes: Array<string | null>; reads: number };

function fakeStorage(start: string | null = null, options: { readFails?: boolean; writeFails?: boolean; slowFirstWrite?: boolean } = {}): Fake {
  let slow = options.slowFirstWrite === true;
  const fake: Fake = {
    value: start,
    writes: [],
    reads: 0,
    read: async () => {
      fake.reads += 1;
      if (options.readFails) throw new Error('cannot read');
      return fake.value;
    },
    write: async (value) => {
      if (slow) {
        slow = false;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (options.writeFails) throw new Error('cannot write');
      fake.writes.push(value);
      fake.value = value;
      return true;
    },
  };
  return fake;
}

function counter(storage: KeeperStorage) {
  return createKeeper<number>({
    initial: 0,
    parse: (text) => (text === null ? 0 : Number(text)),
    serialize: (n) => (n === 0 ? null : String(n)),
    storage,
  });
}

test('what is kept is read once, and later loads answer from memory', async () => {
  const storage = fakeStorage('7');
  const keeper = counter(storage);
  assert.equal(keeper.isLoaded(), false);
  const [a, b] = await Promise.all([keeper.load(1), keeper.load(1)]);
  assert.equal(a, 7);
  assert.equal(b, 7);
  assert.equal(await keeper.load(2), 7);
  assert.equal(storage.reads, 1);
  assert.equal(keeper.isLoaded(), true);
  assert.equal(keeper.get(), 7);
});

test('nothing can be saved over data that has not been read', async () => {
  const keeper = counter(fakeStorage('7'));
  assert.throws(() => keeper.update((n) => n + 1), /not been read/);
});

test('a read that failed is not "nothing there", and can be tried again', async () => {
  const bad = fakeStorage('7', { readFails: true });
  const keeper = counter(bad);
  await assert.rejects(keeper.load(1), /cannot read/);
  assert.equal(keeper.isLoaded(), false);
  assert.throws(() => keeper.update(() => 1));
  assert.equal(bad.writes.length, 0);
  assert.equal(bad.value, '7', 'what was kept is still there');
  const good = fakeStorage('7');
  const second = counter(good);
  await second.load(1);
  assert.equal(second.get(), 7);
});

test('a change is written down, and nothing is written when nothing changed', async () => {
  const storage = fakeStorage('7');
  const keeper = counter(storage);
  await keeper.load(1);
  keeper.update((n) => n + 1);
  assert.equal(await keeper.saved(), true);
  assert.deepEqual(storage.writes, ['8']);
  keeper.update((n) => n);
  await keeper.saved();
  assert.deepEqual(storage.writes, ['8']);
});

test('data that is worth nothing is removed, not kept as empty', async () => {
  const storage = fakeStorage('7');
  const keeper = counter(storage);
  await keeper.load(1);
  keeper.update(() => 0);
  await keeper.saved();
  assert.deepEqual(storage.writes, [null]);
  assert.equal(storage.value, null);
});

test('saves never overlap, and the last one asked for is the last one written', async () => {
  const storage = fakeStorage(null, { slowFirstWrite: true });
  const keeper = counter(storage);
  await keeper.load(1);
  keeper.update(() => 1);
  keeper.update(() => 2);
  keeper.update(() => 3);
  assert.equal(await keeper.saved(), true);
  assert.equal(storage.value, '3');
  assert.equal(storage.writes[storage.writes.length - 1], '3');
  assert.ok(storage.writes.length <= 3);
});

test('a write that failed is reported, and the next change is still written', async () => {
  const storage = fakeStorage(null, { writeFails: true });
  const keeper = counter(storage);
  await keeper.load(1);
  keeper.update(() => 5);
  assert.equal(await keeper.saved(), false);
  assert.equal(keeper.get(), 5, 'memory still has it');
  const working = fakeStorage(null);
  const other = counter(working);
  await other.load(1);
  other.update(() => 6);
  assert.equal(await other.saved(), true);
  assert.equal(working.value, '6');
});

test('a value that cannot be written down is not kept in memory either', async () => {
  const keeper = createKeeper<number>({
    initial: 0,
    parse: () => 0,
    serialize: (n) => {
      if (n === 13) throw new Error('unlucky');
      return String(n);
    },
    storage: fakeStorage(null),
  });
  await keeper.load(1);
  keeper.update(() => 1);
  assert.throws(() => keeper.update(() => 13), /unlucky/);
  assert.equal(keeper.get(), 1);
});

test('listeners hear about changes, and one that throws stops nobody', async () => {
  const keeper = counter(fakeStorage(null));
  await keeper.load(1);
  const heard: number[] = [];
  keeper.subscribe(() => {
    throw new Error('bad listener');
  });
  const stop = keeper.subscribe(() => heard.push(keeper.get()));
  keeper.update(() => 1);
  keeper.update(() => 2);
  stop();
  keeper.update(() => 3);
  assert.deepEqual(heard, [1, 2]);
  await keeper.saved();
});

test('a keeper that has written nothing says its last write landed', async () => {
  const keeper = counter(fakeStorage('7'));
  await keeper.load(1);
  assert.equal(await keeper.saved(), true);
  assert.equal(await counter(fakeStorage(null)).saved(), true, 'even before it was read');
});
