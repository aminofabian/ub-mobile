import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import {
  actionsFor,
  branchName,
  classifyStep,
  destinations,
  didStepHappen,
  directionFor,
  MAX_TRANSFER_LINES,
  overdrawn,
  planProblemWords,
  planTransfer,
  readCreated,
  readTransfers,
  sortForBranch,
  statusWords,
  stepFailureWords,
  stepPath,
  type PlanProblem,
  type Transfer,
} from '../src/lib/transfers';

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 't1',
    status: 'draft',
    fromBranchId: 'main',
    toBranchId: 'east',
    notes: null,
    createdAt: '2026-11-23T08:00:00Z',
    createdBy: 'u1',
    lines: [{ itemId: 'i1', itemName: 'Milk', quantity: 12 }],
    ...over,
  };
}

function transfer(over: Record<string, unknown> = {}): Transfer {
  const read = readTransfers([row(over)]);
  assert.ok(read && read[0]);
  return read[0];
}

test('transfers are read with their lines', () => {
  const read = readTransfers([row()]);
  assert.deepEqual(read, [
    { id: 't1', status: 'draft', fromBranchId: 'main', toBranchId: 'east', notes: null, createdAt: Date.parse('2026-11-23T08:00:00Z'), lines: [{ itemId: 'i1', name: 'Milk', units: 120000 }] },
  ]);
});

test('rows that are not transfers are left out, and an answer that is not a list is a failed read', () => {
  const read = readTransfers([row(), null, 'x', row({ id: '' }), row({ fromBranchId: null }), row({ id: 't2', lines: 'none', status: 'strange', createdAt: 'x' })]);
  assert.deepEqual(read?.map((t) => t.id), ['t1', 't2']);
  assert.equal(read?.[1]?.status, 'unknown');
  assert.equal(read?.[1]?.createdAt, null);
  assert.deepEqual(read?.[1]?.lines, []);
  for (const bad of [null, undefined, {}, 'x', { content: [] }]) {
    assert.equal(readTransfers(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(readTransfers([]), []);
});

test('lines with no item or no quantity are left out of a transfer', () => {
  const read = transfer({ lines: [{ itemId: 'i1', itemName: 'Milk', quantity: 1 }, { itemId: '', quantity: 1 }, { itemId: 'i2', quantity: 0 }, { itemId: 'i3', quantity: 'many' }, { itemId: 'i4', quantity: '2.5' }] });
  assert.deepEqual(read.lines.map((line) => [line.itemId, line.units]), [['i1', 10000], ['i4', 25000]]);
  assert.equal(read.lines[1]?.name, 'Item');
});

test('a created transfer answer gives its id', () => {
  assert.deepEqual(readCreated({ id: 't9', status: 'draft' }), { id: 't9' });
  for (const bad of [null, {}, { id: '' }, 'x', { id: 4 }]) {
    assert.equal(readCreated(bad), null);
  }
});

test('a transfer goes out of one branch and into another', () => {
  const t = transfer();
  assert.equal(directionFor(t, 'main'), 'out');
  assert.equal(directionFor(t, 'east'), 'in');
  assert.equal(directionFor(t, 'west'), 'other');
});

test('the source sends its drafts, the destination receives what is on its way, and either may cancel a draft', () => {
  const draft = transfer();
  assert.deepEqual(actionsFor(draft, 'main', true), ['send', 'cancel']);
  assert.deepEqual(actionsFor(draft, 'east', true), ['cancel']);
  assert.deepEqual(actionsFor(draft, 'west', true), []);
  const onItsWay = transfer({ status: 'in_transit' });
  assert.deepEqual(actionsFor(onItsWay, 'east', true), ['receive', 'cancel']);
  assert.deepEqual(actionsFor(onItsWay, 'main', true), [], 'the sender can only wait');
  assert.deepEqual(actionsFor(onItsWay, 'west', true), []);
});

test('a finished transfer, or a person who may not move stock, has no actions', () => {
  assert.deepEqual(actionsFor(transfer({ status: 'completed' }), 'east', true), []);
  assert.deepEqual(actionsFor(transfer({ status: 'cancelled' }), 'main', true), []);
  assert.deepEqual(actionsFor(transfer({ status: 'strange' }), 'main', true), []);
  assert.deepEqual(actionsFor(transfer(), 'main', false), []);
  assert.deepEqual(actionsFor(transfer({ status: 'in_transit' }), 'east', false), []);
});

test('each transfer says where it is from the branch\'s side', () => {
  assert.equal(statusWords(transfer(), 'main'), 'Draft: not sent yet');
  assert.equal(statusWords(transfer(), 'east'), 'Being prepared by the other branch');
  assert.match(statusWords(transfer({ status: 'in_transit' }), 'east'), /receive it when it arrives/);
  assert.match(statusWords(transfer({ status: 'in_transit' }), 'main'), /other branch will receive/);
  assert.equal(statusWords(transfer({ status: 'completed' }), 'east'), 'Received');
  assert.equal(statusWords(transfer({ status: 'cancelled' }), 'east'), 'Cancelled');
  assert.equal(statusWords(transfer({ status: 'strange' }), 'east'), 'Unknown');
});

test('a transfer plan has the branches, the items and the amounts the server wants', () => {
  const planned = planTransfer({ fromBranchId: 'main', toBranchId: 'east', lines: [{ itemId: 'i1', units: 25000 }, { itemId: 'i2', units: 10000 }], note: '  for the weekend  ' });
  assert.deepEqual(planned, {
    ok: true,
    body: { fromBranchId: 'main', toBranchId: 'east', notes: 'for the weekend', lines: [{ itemId: 'i1', quantity: 2.5 }, { itemId: 'i2', quantity: 1 }] },
  });
  const plain = planTransfer({ fromBranchId: 'main', toBranchId: 'east', lines: [{ itemId: 'i1', units: 10000 }] });
  assert.ok(plain.ok);
  assert.equal('notes' in plain.body, false);
});

test('the same item twice is one line with both amounts', () => {
  const planned = planTransfer({ fromBranchId: 'main', toBranchId: 'east', lines: [{ itemId: 'i1', units: 10000 }, { itemId: 'i1', units: 5000 }] });
  assert.ok(planned.ok);
  assert.deepEqual(planned.body.lines, [{ itemId: 'i1', quantity: 1.5 }]);
});

test('what cannot be a transfer is refused with a reason', () => {
  const ok = [{ itemId: 'i1', units: 10000 }];
  assert.deepEqual(planTransfer({ fromBranchId: 'main', toBranchId: 'main', lines: ok }), { ok: false, problem: 'same_branch' });
  assert.deepEqual(planTransfer({ fromBranchId: '', toBranchId: 'east', lines: ok }), { ok: false, problem: 'no_branch' });
  assert.deepEqual(planTransfer({ fromBranchId: 'main', toBranchId: '', lines: ok }), { ok: false, problem: 'no_branch' });
  assert.deepEqual(planTransfer({ fromBranchId: 'main', toBranchId: 'east', lines: [] }), { ok: false, problem: 'no_lines' });
  for (const units of [0, -1, 1.5, Number.NaN]) {
    assert.deepEqual(planTransfer({ fromBranchId: 'main', toBranchId: 'east', lines: [{ itemId: 'i1', units }] }), { ok: false, problem: 'bad_quantity' }, String(units));
  }
  assert.deepEqual(planTransfer({ fromBranchId: 'main', toBranchId: 'east', lines: [{ itemId: '', units: 1 }] }), { ok: false, problem: 'bad_quantity' });
  const many = Array.from({ length: MAX_TRANSFER_LINES + 1 }, (_, n) => ({ itemId: `i${n}`, units: 10000 }));
  assert.deepEqual(planTransfer({ fromBranchId: 'main', toBranchId: 'east', lines: many }), { ok: false, problem: 'too_many_lines' });
  const problems: PlanProblem[] = ['same_branch', 'no_branch', 'no_lines', 'bad_quantity', 'too_many_lines'];
  assert.equal(new Set(problems.map(planProblemWords)).size, problems.length);
});

test('items asking for more than the source holds are named, and unknown stock names nobody', () => {
  assert.deepEqual(
    overdrawn([
      { name: 'Milk', units: 50000, onHandUnits: 30000 },
      { name: 'Bread', units: 10000, onHandUnits: 10000 },
      { name: 'Eggs', units: 10000, onHandUnits: null },
    ]),
    ['Milk']
  );
});

test('the branches to send to are every branch but this one, by name', () => {
  const branches = [{ id: 'main', name: 'Main' }, { id: 'west', name: 'West Shop' }, { id: 'east', name: 'East Shop' }, { id: 'east', name: 'Dup' }, { id: '', name: 'No id' }, { id: 'x', name: '  ' }, { name: 'Nothing' }];
  assert.deepEqual(destinations(branches, 'main'), [{ id: 'east', name: 'East Shop' }, { id: 'west', name: 'West Shop' }]);
  assert.equal(branchName(branches, 'west'), 'West Shop');
  assert.equal(branchName(branches, 'gone'), 'Another branch');
});

test('a failed step is a doubt, a step already taken, a refusal or a gone transfer, by its status', () => {
  assert.equal(classifyStep(new Error('Network request failed')), 'doubt');
  for (const status of [500, 502, 503, 401, 408, 423, 429]) assert.equal(classifyStep(new ApiError('x', { status })), 'doubt', String(status));
  assert.equal(classifyStep(new ApiError('x', { status: 403, foreign: true })), 'doubt', 'a web page is not the server saying no');
  assert.equal(classifyStep(new ApiError('x', { status: 409 })), 'moved_on');
  assert.equal(classifyStep(new ApiError('x', { status: 403 })), 'not_yours');
  assert.equal(classifyStep(new ApiError('x', { status: 404 })), 'gone');
  assert.equal(classifyStep(new ApiError('x', { status: 400 })), 'refused');
  assert.match(stepFailureWords('receive', 'not_yours'), /Only the branch it is going to/);
  assert.match(stepFailureWords('send', 'not_yours'), /Your branch cannot/);
  assert.notEqual(stepFailureWords('send', 'doubt'), stepFailureWords('send', 'moved_on'));
});

test('after a step with no answer, only the state the step leads to says it happened', () => {
  assert.equal(didStepHappen('send', transfer({ status: 'in_transit' })), 'done');
  assert.equal(didStepHappen('send', transfer({ status: 'completed' })), 'done');
  assert.equal(didStepHappen('send', transfer({ status: 'draft' })), 'not_done');
  assert.equal(didStepHappen('send', transfer({ status: 'cancelled' })), 'unclear');
  assert.equal(didStepHappen('receive', transfer({ status: 'completed' })), 'done');
  assert.equal(didStepHappen('receive', transfer({ status: 'in_transit' })), 'not_done');
  assert.equal(didStepHappen('receive', transfer({ status: 'draft' })), 'unclear');
  assert.equal(didStepHappen('cancel', transfer({ status: 'cancelled' })), 'done');
  assert.equal(didStepHappen('cancel', transfer({ status: 'draft' })), 'not_done');
  assert.equal(didStepHappen('cancel', transfer({ status: 'in_transit' })), 'not_done');
  assert.equal(didStepHappen('cancel', transfer({ status: 'completed' })), 'unclear');
  assert.equal(didStepHappen('send', undefined), 'unclear');
});

test('the path of a step is encoded', () => {
  assert.equal(stepPath('send', 't 1'), '/api/v1/inventory/transfers/t%201/send');
  assert.equal(stepPath('receive', 't1'), '/api/v1/inventory/transfers/t1/receive');
  assert.equal(stepPath('cancel', 't1'), '/api/v1/inventory/transfers/t1/cancel');
});

test('what needs this branch comes first, then the newest', () => {
  const list = readTransfers([
    row({ id: 'old-done', status: 'completed', createdAt: '2026-11-22T08:00:00Z' }),
    row({ id: 'arriving', status: 'in_transit', fromBranchId: 'east', toBranchId: 'main', createdAt: '2026-11-21T08:00:00Z' }),
    row({ id: 'my-draft', status: 'draft', createdAt: '2026-11-20T08:00:00Z' }),
    row({ id: 'new-done', status: 'completed', createdAt: '2026-11-23T08:00:00Z' }),
    row({ id: 'sent-away', status: 'in_transit', createdAt: '2026-11-23T09:00:00Z' }),
  ]) ?? [];
  assert.deepEqual(sortForBranch(list, 'main').map((t) => t.id), ['arriving', 'my-draft', 'sent-away', 'new-done', 'old-done']);
});

test('lines that are not lines are left out of a transfer, and an id is kept up to sixty-four characters', () => {
  const read = transfer({ lines: [null, 'x', 5, { itemId: 'i1', itemName: 'Milk', quantity: 1 }] });
  assert.deepEqual(read.lines.map((line) => line.itemId), ['i1']);
  assert.equal(transfer({ id: 'x'.repeat(64) }).id, 'x'.repeat(64));
  assert.deepEqual(readTransfers([row({ id: 'x'.repeat(65) })]), [], 'a longer id is not an id');
  assert.deepEqual(readTransfers([row({ toBranchId: 'b'.repeat(65) })]), []);
});

test('a transfer may carry exactly the most items, and not one more', () => {
  const lines = (count: number) => Array.from({ length: count }, (_, n) => ({ itemId: `i${n}`, units: 10000 }));
  const full = planTransfer({ fromBranchId: 'main', toBranchId: 'east', lines: lines(MAX_TRANSFER_LINES) });
  assert.ok(full.ok);
  assert.equal(full.body.lines.length, MAX_TRANSFER_LINES);
  assert.deepEqual(planTransfer({ fromBranchId: 'main', toBranchId: 'east', lines: lines(MAX_TRANSFER_LINES + 1) }), { ok: false, problem: 'too_many_lines' });
  const repeated = planTransfer({ fromBranchId: 'main', toBranchId: 'east', lines: Array.from({ length: MAX_TRANSFER_LINES + 5 }, () => ({ itemId: 'i1', units: 10000 })) });
  assert.ok(repeated.ok);
  assert.equal(repeated.body.lines.length, 1, 'the same item again and again is still one line');
});
