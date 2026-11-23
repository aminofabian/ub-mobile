import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpenGate } from '../src/lib/open-gate';

function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, no) => {
    resolve = ok;
    reject = no;
  });
  return { promise, resolve, reject };
}

test('while one shop is being opened, another is refused and its work is never started', async () => {
  const gate = createOpenGate();
  const first = pending<string>();
  const started: string[] = [];

  const a = gate.run(async () => {
    started.push('a');
    return first.promise;
  });
  assert.equal(gate.isBusy(), true);

  const b = await gate.run(async () => {
    started.push('b');
    return 'b';
  });
  assert.deepEqual(b, { ran: false });
  assert.deepEqual(started, ['a']);

  first.resolve('opened a');
  assert.deepEqual(await a, { ran: true, value: 'opened a' });
  assert.equal(gate.isBusy(), false);

  assert.deepEqual(await gate.run(async () => 'c'), { ran: true, value: 'c' });
});

test('an open that fails frees the gate, and the failure still reaches the one who started it', async () => {
  const gate = createOpenGate();
  await assert.rejects(
    gate.run(async () => {
      throw new Error('no connection');
    }),
    /no connection/,
  );
  assert.equal(gate.isBusy(), false);

  await assert.rejects(
    gate.run(() => {
      throw new Error('thrown before it started waiting');
    }),
    /thrown before/,
  );
  assert.equal(gate.isBusy(), false);
  assert.deepEqual(await gate.run(async () => 1), { ran: true, value: 1 });
});

test('whoever is listening hears when the gate closes and when it opens, and stops when told to', async () => {
  const gate = createOpenGate();
  const heard: boolean[] = [];
  const stop = gate.subscribe(() => heard.push(gate.isBusy()));

  await gate.run(async () => undefined);
  assert.deepEqual(heard, [true, false]);

  // A refused open changes nothing, so it says nothing.
  const hold = pending<void>();
  const running = gate.run(() => hold.promise);
  await gate.run(async () => undefined);
  hold.resolve();
  await running;
  assert.deepEqual(heard, [true, false, true, false]);

  stop();
  await gate.run(async () => undefined);
  assert.equal(heard.length, 4);
});
