import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { classifySend, createCountSender } from '../src/lib/count-sender';
import { newCopy, readTake, typeCount, type TakeCopy } from '../src/lib/stock-take';

function line(n: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: `l${n}`, itemId: `i${n}`, itemName: `Item ${n}`, itemSku: null, systemQtySnapshot: 10, countedQty: null, status: 'pending', ...over };
}

function startCopy(status = 'in_progress'): TakeCopy {
  const take = readTake({ id: 's1', branchId: 'b1', status, sessionType: 'morning', sessionDate: '2026-11-23', name: 'n', lines: [line(1), line(2), line(3)] });
  assert.ok(take);
  return newCopy(take, 1000);
}

function typed(copy: TakeCopy, lineId: string, units: number, at: number): TakeCopy {
  const result = typeCount(copy, lineId, units, at);
  assert.ok(result.ok);
  return result.copy;
}

function harness(initial: TakeCopy | null, send: (sessionId: string, lineId: string, units: number) => Promise<void>, explain?: () => Promise<void>, live?: () => boolean) {
  const box = { copy: initial };
  const sender = createCountSender({
    read: () => box.copy,
    change: (change) => {
      if (box.copy) box.copy = change(box.copy);
    },
    send,
    explain,
    live,
  });
  return { box, sender };
}

const api = (status: number, extra: Record<string, unknown> = {}) => new ApiError('x', { status, ...extra });

test('a failed send is waited out unless the server said no', () => {
  assert.deepEqual(classifySend(new Error('Network request failed')), { kind: 'wait' });
  assert.deepEqual(classifySend(new TypeError('x')), { kind: 'wait' });
  for (const status of [401, 408, 423, 429, 500, 502, 503, 504, 522]) {
    assert.deepEqual(classifySend(api(status)), { kind: 'wait' }, String(status));
  }
  assert.deepEqual(classifySend(api(409)), { kind: 'problem', problem: 'conflict' });
  for (const status of [400, 403, 404, 422]) {
    assert.deepEqual(classifySend(api(status)), { kind: 'problem', problem: 'refused' }, String(status));
  }
  assert.deepEqual(classifySend(api(403, { foreign: true })), { kind: 'wait' }, 'a web page in the server\'s place is not the server saying no');
  assert.deepEqual(classifySend(api(409, { foreign: true })), { kind: 'wait' }, 'a sign-in page that answers 409 is not the server saying the count conflicts');
});

test('every waiting count is sent, oldest first, and then nothing waits', async () => {
  const seen: string[] = [];
  let copy = typed(typed(typed(startCopy(), 'l2', 20000, 2000), 'l1', 10000, 1000), 'l3', 30000, 3000);
  copy = { ...copy };
  const { box, sender } = harness(copy, async (sessionId, lineId, units) => {
    seen.push(`${sessionId}/${lineId}/${units}`);
  });
  const report = await sender.flush();
  assert.deepEqual(seen, ['s1/l1/10000', 's1/l2/20000', 's1/l3/30000']);
  assert.deepEqual(report, { sent: 3, refused: 0, stopped: false });
  assert.deepEqual(box.copy?.pending, {});
  assert.deepEqual(box.copy?.take.lines.map((l) => l.countedUnits), [10000, 20000, 30000]);
});

test('with no connection the first send ends the pass and nothing is marked', async () => {
  const seen: string[] = [];
  const { box, sender } = harness(typed(typed(startCopy(), 'l1', 10000, 1000), 'l2', 20000, 2000), async (_s, lineId) => {
    seen.push(lineId);
    throw new Error('Network request failed');
  });
  const report = await sender.flush();
  assert.deepEqual(seen, ['l1'], 'one try, not one per line');
  assert.deepEqual(report, { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(Object.values(box.copy?.pending ?? {}).map((entry) => entry.problem), [null, null]);
});

test('a refused count is marked, the rest still go, and a conflict makes the server be asked why', async () => {
  const explained: number[] = [];
  const { box, sender } = harness(
    typed(typed(typed(startCopy(), 'l1', 10000, 1000), 'l2', 20000, 2000), 'l3', 30000, 3000),
    async (_s, lineId) => {
      if (lineId === 'l1') throw api(409);
      if (lineId === 'l2') throw api(403);
    },
    async () => {
      explained.push(1);
    }
  );
  const report = await sender.flush();
  assert.deepEqual(report, { sent: 1, refused: 2, stopped: false });
  assert.equal(box.copy?.pending.l1?.problem, 'conflict');
  assert.equal(box.copy?.pending.l2?.problem, 'refused');
  assert.equal(box.copy?.pending.l3, undefined);
  assert.equal(explained.length, 1);
});

test('a count that was refused is not sent again until a person asks', async () => {
  const seen: string[] = [];
  const { sender } = harness(typed(startCopy(), 'l1', 10000, 1000), async (_s, lineId) => {
    seen.push(lineId);
    throw api(403);
  });
  await sender.flush();
  await sender.flush();
  await sender.flush();
  assert.deepEqual(seen, ['l1']);
});

test('a failure to explain a conflict is not a failure of the pass', async () => {
  const { box, sender } = harness(
    typed(startCopy(), 'l1', 10000, 1000),
    async () => {
      throw api(409);
    },
    async () => {
      throw new Error('offline again');
    }
  );
  const report = await sender.flush();
  assert.deepEqual(report, { sent: 0, refused: 1, stopped: false });
  assert.equal(box.copy?.pending.l1?.problem, 'conflict');
});

test('a count typed while an older one is on its way is sent as well, in the same flush', async () => {
  const seen: string[] = [];
  const holder: { sender?: ReturnType<typeof createCountSender> } = {};
  const box = { copy: typed(startCopy(), 'l1', 10000, 1000) as TakeCopy | null };
  let first = true;
  holder.sender = createCountSender({
    read: () => box.copy,
    change: (change) => {
      if (box.copy) box.copy = change(box.copy);
    },
    send: async (_s, lineId, units) => {
      seen.push(`${lineId}/${units}`);
      if (first) {
        first = false;
        // The person types the line again while the first count is on its way, and the screen asks for a send.
        box.copy = box.copy ? typed(box.copy, 'l1', 90000, 2000) : box.copy;
        void holder.sender?.flush();
      }
    },
  });
  const report = await holder.sender.flush();
  assert.deepEqual(seen, ['l1/10000', 'l1/90000']);
  assert.equal(report.sent, 2);
  assert.deepEqual(box.copy?.pending, {});
  assert.equal(box.copy?.take.lines[0]?.countedUnits, 90000, 'the line ends on the newer count');
});

test('a flush asked for while one is running shares it, and does not send twice', async () => {
  let sends = 0;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { sender } = harness(typed(startCopy(), 'l1', 10000, 1000), async () => {
    sends += 1;
    await gate;
  });
  const a = sender.flush();
  const b = sender.flush();
  release();
  const [first, second] = await Promise.all([a, b]);
  assert.equal(sends, 1);
  assert.equal(first, second);
});

test('nothing is sent for a stock take that is closed, or when there is none', async () => {
  let sends = 0;
  const count = async () => {
    sends += 1;
  };
  const closed = harness(typed(startCopy(), 'l1', 10000, 1000), count);
  closed.box.copy = closed.box.copy ? { ...closed.box.copy, take: { ...closed.box.copy.take, open: false } } : null;
  assert.deepEqual(await closed.sender.flush(), { sent: 0, refused: 0, stopped: false });
  assert.deepEqual(await harness(null, count).sender.flush(), { sent: 0, refused: 0, stopped: false });
  assert.equal(sends, 0);
});

test('when the stock take is replaced while sending, the rest of the old one is not sent into the new one', async () => {
  const seen: string[] = [];
  const box = { copy: typed(typed(startCopy(), 'l1', 10000, 1000), 'l2', 20000, 2000) as TakeCopy | null };
  const sender = createCountSender({
    read: () => box.copy,
    change: (change) => {
      if (box.copy) box.copy = change(box.copy);
    },
    send: async (_s, lineId) => {
      seen.push(lineId);
      const other = readTake({ id: 's2', branchId: 'b1', status: 'in_progress', lines: [line(2)] });
      box.copy = other ? newCopy(other, 5000) : null;
    },
  });
  await sender.flush();
  assert.deepEqual(seen, ['l1']);
  assert.equal(box.copy?.take.id, 's2');
  assert.deepEqual(box.copy?.pending, {});
});

test('the server is asked why only after a conflict, not after a plain refusal or a clean pass', async () => {
  let asked = 0;
  const explain = async () => {
    asked += 1;
  };
  const clean = harness(typed(startCopy(), 'l1', 10000, 1000), async () => undefined, explain);
  assert.deepEqual(await clean.sender.flush(), { sent: 1, refused: 0, stopped: false });
  const plain = harness(
    typed(startCopy(), 'l1', 10000, 1000),
    async () => {
      throw api(403);
    },
    explain
  );
  assert.deepEqual(await plain.sender.flush(), { sent: 0, refused: 1, stopped: false });
  assert.equal(asked, 0);
  const conflict = harness(
    typed(startCopy(), 'l1', 10000, 1000),
    async () => {
      throw api(409);
    },
    explain
  );
  await conflict.sender.flush();
  assert.equal(asked, 1);
  const alone = harness(typed(startCopy(), 'l1', 10000, 1000), async () => {
    throw api(409);
  });
  assert.deepEqual(await alone.sender.flush(), { sent: 0, refused: 1, stopped: false });
  assert.equal(alone.box.copy?.pending.l1?.problem, 'conflict', 'with nobody to ask, the count is only marked');
});

test('when the stock take is gone while sending, nothing more is sent and nothing breaks', async () => {
  const seen: string[] = [];
  const box = { copy: typed(typed(startCopy(), 'l1', 10000, 1000), 'l2', 20000, 2000) as TakeCopy | null };
  const sender = createCountSender({
    read: () => box.copy,
    change: (change) => {
      if (box.copy) box.copy = change(box.copy);
    },
    send: async (_s, lineId) => {
      seen.push(lineId);
      box.copy = null;
    },
  });
  assert.deepEqual(await sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(seen, ['l1']);
});

test('the rest of an old stock take is not sent, even when the new one has counts waiting under the same lines', async () => {
  const seen: string[] = [];
  const box = { copy: typed(typed(startCopy(), 'l1', 10000, 1000), 'l2', 20000, 2000) as TakeCopy | null };
  const sender = createCountSender({
    read: () => box.copy,
    change: (change) => {
      if (box.copy) box.copy = change(box.copy);
    },
    send: async (sessionId, lineId) => {
      seen.push(`${sessionId}/${lineId}`);
      const other = readTake({ id: 's2', branchId: 'b1', status: 'in_progress', lines: [line(1), line(2)] });
      assert.ok(other);
      box.copy = typed(newCopy(other, 5000), 'l2', 55000, 5000);
    },
  });
  await sender.flush();
  assert.deepEqual(seen, ['s1/l1']);
  assert.equal(box.copy?.take.id, 's2');
  assert.equal(box.copy?.pending.l2?.units, 55000, 'the new stock take keeps its own count');
});

test('a count that is taken away or marked while an earlier one is on its way is not sent', async () => {
  const seen: string[] = [];
  const box = { copy: typed(typed(typed(startCopy(), 'l1', 10000, 1000), 'l2', 20000, 2000), 'l3', 30000, 3000) as TakeCopy | null };
  const sender = createCountSender({
    read: () => box.copy,
    change: (change) => {
      if (box.copy) box.copy = change(box.copy);
    },
    send: async (_s, lineId) => {
      seen.push(lineId);
      if (lineId !== 'l1' || !box.copy) return;
      const pending = { ...box.copy.pending };
      delete pending.l2;
      const third = pending.l3;
      if (third) pending.l3 = { ...third, problem: 'refused' };
      box.copy = { ...box.copy, pending };
    },
  });
  assert.deepEqual(await sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(seen, ['l1']);
  assert.equal(box.copy?.pending.l3?.problem, 'refused');
});

test('a sender that has gone sends nothing, and says it stopped', async () => {
  const seen: string[] = [];
  const { box, sender } = harness(
    typed(startCopy(), 'l1', 10000, 1000),
    async (_sessionId, lineId) => {
      seen.push(lineId);
    },
    undefined,
    () => false
  );
  assert.deepEqual(await sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(seen, []);
  assert.deepEqual(Object.keys(box.copy?.pending ?? {}), ['l1'], 'the count still waits');
});

test('a sender that goes while sending writes down what it sent, and sends no more', async () => {
  let open = true;
  const seen: string[] = [];
  const { box, sender } = harness(
    typed(typed(startCopy(), 'l1', 10000, 1000), 'l2', 20000, 2000),
    async (_sessionId, lineId) => {
      seen.push(lineId);
      open = false;
    },
    undefined,
    () => open
  );
  const report = await sender.flush();
  assert.deepEqual(seen, ['l1']);
  assert.deepEqual(report, { sent: 1, refused: 0, stopped: true });
  assert.deepEqual(Object.keys(box.copy?.pending ?? {}), ['l2'], 'the count that went is written down, the other still waits');
});

test('a sender that has gone does not go and ask why after a conflict', async () => {
  let open = true;
  let asked = 0;
  const { box, sender } = harness(
    typed(startCopy(), 'l1', 10000, 1000),
    async () => {
      open = false;
      throw api(409);
    },
    async () => {
      asked += 1;
    },
    () => open
  );
  const report = await sender.flush();
  assert.equal(asked, 0);
  assert.equal(report.refused, 1);
  assert.equal(box.copy?.pending.l1?.problem, 'conflict', 'the conflict is still written down');
});
