import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEING_SENT_NOW, sendNow } from '../src/lib/send-now';

const ITEM = { id: 'k-1' };

function deps(over: Partial<Parameters<typeof sendNow>[1]> = {}) {
  const calls = { sent: 0, removed: [] as string[] };
  return {
    calls,
    deps: {
      isBeingSent: () => false,
      send: async () => {
        calls.sent += 1;
        return { id: 'sale-1', grandTotal: 600 };
      },
      remove: async (id: string) => {
        calls.removed.push(id);
      },
      ...over,
    },
  };
}

test('a sale that is being sent right now is not sent a second time', async () => {
  const { calls, deps: d } = deps({ isBeingSent: (id: string) => id === 'k-1' });
  assert.deepEqual(await sendNow(ITEM, d), { kind: 'busy' });
  assert.equal(calls.sent, 0, 'no second request goes out under the same key');
  assert.deepEqual(calls.removed, []);
  assert.match(BEING_SENT_NOW, /being sent right now/);
});

test('a sale the server took leaves the list, and what the server said comes back', async () => {
  const { calls, deps: d } = deps();
  assert.deepEqual(await sendNow(ITEM, d), { kind: 'sent', response: { id: 'sale-1', grandTotal: 600 } });
  assert.equal(calls.sent, 1);
  assert.deepEqual(calls.removed, ['k-1']);
});

test('a sale that could not be sent stays on the list, with the reason', async () => {
  const why = new Error('no answer');
  const { calls, deps: d } = deps({
    send: async () => {
      throw why;
    },
  });
  const result = await sendNow(ITEM, d);
  assert.deepEqual(result, { kind: 'failed', error: why });
  assert.deepEqual(calls.removed, [], 'nothing is taken off the list that the server may not have');
});

test('a list that cannot be changed does not turn a sent sale into a failure', async () => {
  const { deps: d } = deps({
    remove: async () => {
      throw new Error('storage is full');
    },
  });
  const result = await sendNow(ITEM, d);
  assert.equal(result.kind, 'sent', 'the server has it; the next send is recognised by its key');
});
