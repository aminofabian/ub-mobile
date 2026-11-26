import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { addItem, emptyBasket, type SaleItem } from '../src/lib/basket';
import { createForwardSender, type ForwardDeps, type ForwardSender } from '../src/lib/forward-sender';
import {
  discardForward,
  DRAFT_GONE,
  DRAFTS_OFF,
  draftName,
  forwardWords,
  leftByOthers,
  MIXED_IN,
  NO_FORWARDS,
  OPEN_ELSEWHERE,
  startForward,
  type ForwardEntry,
  type ForwardState,
} from '../src/lib/forward';

const ONE = 10_000;
const SUGAR: SaleItem = { id: 'i1', name: 'Sugar', variantName: null, weighed: false, unitType: null, active: true, sellable: true, sellingCents: 19900 };

function queue(state: ForwardState, n: number, ownerId = 'u1'): ForwardState {
  const basket = addItem(emptyBasket({ ownerId, branchId: 'b1' }, 1000 + n), SUGAR, n * ONE, 1000 + n, `L${n}`);
  assert.ok(basket.ok);
  const result = startForward(state, basket.basket, { id: `s${n}`, issueKey: `k${n}` }, 5000 + n);
  assert.ok(result.ok);
  return result.state;
}

type Fault = 'network' | { status: number; type?: string } | 'lose_answer' | 'garbage' | 'cancelled_draft' | 'merge';

/** A server that behaves like the real one: asking again with the same name or key gives back what it already made. */
function harness(options: { faults?: Record<string, Fault[]>; onDraft?: (entry: ForwardEntry) => void } = {}) {
  let state: ForwardState = NO_FORWARDS;
  const server = { drafts: new Map<string, { id: string; status: string }>(), invoices: new Map<string, { invoiceId: string; draftId: string }>() };
  const log: string[] = [];
  let busy = 0;
  let mostBusy = 0;
  const faults = options.faults ?? {};

  function fault(step: string, id: string): Fault | undefined {
    return faults[`${step}:${id}`]?.shift();
  }
  function throwFor(f: Fault): never {
    if (f === 'network') throw new TypeError('Network request failed');
    if (typeof f === 'object') throw new ApiError('no', { status: f.status, ...(f.type ? { type: f.type } : {}) });
    throw new Error('unreachable');
  }

  const deps: ForwardDeps = {
    ownerId: 'u1',
    read: () => state,
    change: (change) => {
      state = change(state);
    },
    makeDraft: async (entry) => {
      busy += 1;
      mostBusy = Math.max(mostBusy, busy);
      try {
        log.push(`draft ${entry.id}`);
        options.onDraft?.(entry);
        await Promise.resolve();
        const f = fault('draft', entry.id);
        if (f === 'network' || (typeof f === 'object' && f)) throwFor(f);
        // The server puts a new sale's lines into the draft that is already open, and answers with that one.
        if (f === 'merge') return { id: 'web-1', clientDraftId: 'web-uuid-1', status: 'building' };
        let draft = server.drafts.get(entry.id);
        if (!draft) {
          draft = { id: `d-${entry.id}`, status: 'building' };
          server.drafts.set(entry.id, draft);
        }
        if (f === 'lose_answer') throw new TypeError('Network request failed');
        if (f === 'garbage') return { hello: 'world' };
        if (f === 'cancelled_draft') return { id: draft.id, clientDraftId: draftName(entry.id), status: 'cancelled' };
        return { id: draft.id, clientDraftId: draftName(entry.id), status: draft.status };
      } finally {
        busy -= 1;
      }
    },
    issue: async (entry) => {
      busy += 1;
      mostBusy = Math.max(mostBusy, busy);
      try {
        log.push(`issue ${entry.id} ${entry.issueKey}`);
        await Promise.resolve();
        const f = fault('issue', entry.id);
        if (f === 'network' || (typeof f === 'object' && f)) throwFor(f);
        let invoice = server.invoices.get(entry.issueKey);
        const createdNew = !invoice;
        if (!invoice) {
          invoice = { invoiceId: `inv-${entry.id}`, draftId: entry.draftId as string };
          server.invoices.set(entry.issueKey, invoice);
          const made = [...server.drafts.values()].find((d) => d.id === entry.draftId);
          if (made) made.status = 'issued';
        }
        if (f === 'lose_answer') throw new TypeError('Network request failed');
        if (f === 'garbage') return 'not json';
        return {
          draftId: invoice.draftId,
          counterNumber: 7,
          status: 'issued',
          invoiceId: invoice.invoiceId,
          invoice: { id: invoice.invoiceId, barcodeCode: `code-${entry.id}`, status: 'pending_payment', grandTotal: 199 },
          createdNew,
        };
      } finally {
        busy -= 1;
      }
    },
    now: () => 9000,
  };
  return {
    server,
    log,
    deps,
    sender: createForwardSender(deps),
    get state() {
      return state;
    },
    set state(next: ForwardState) {
      state = next;
    },
    get mostBusy() {
      return mostBusy;
    },
  };
}

test('sales are sent oldest first, each as a draft and then an invoice, and the answers are recorded', async () => {
  const h = harness();
  h.state = queue(queue(NO_FORWARDS, 1), 2);
  const report = await h.sender.flush();
  assert.deepEqual(report, { sent: 2, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['draft s1', 'issue s1 k1', 'draft s2', 'issue s2 k2']);
  const [a, b] = h.state.entries;
  assert.equal(a?.result?.code, 'code-s1');
  assert.equal(a?.result?.totalCents, 19900);
  assert.equal(b?.result?.invoiceId, 'inv-s2');
  assert.deepEqual([a?.lines, a?.inDoubt, a?.draftId], [[], false, 'd-s1']);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: false });
  assert.equal(h.log.length, 4, 'nothing is sent twice');
});

test('a lost answer to the draft is asked again under the same name, and the server makes one draft', async () => {
  const h = harness({ faults: { 'draft:s1': ['lose_answer'] } });
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.equal(h.state.entries[0]?.inDoubt, true);
  assert.equal(h.state.entries[0]?.draftId, null);
  assert.equal(forwardWords(h.state.entries[0]!, 9000), 'in_doubt');
  assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.equal(h.server.drafts.size, 1);
  assert.equal(h.server.invoices.size, 1);
});

test('a lost answer to the invoice is asked again under the same key, and the server makes one invoice', async () => {
  const h = harness({ faults: { 'issue:s1': ['lose_answer'] } });
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true });
  const waiting = h.state.entries[0]!;
  assert.equal(waiting.draftId, 'd-s1');
  assert.equal(waiting.inDoubt, true);
  assert.equal(h.server.invoices.size, 1, 'the server had already made it');
  assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['draft s1', 'issue s1 k1', 'issue s1 k1']);
  assert.equal(h.server.drafts.size, 1, 'the draft is not made again');
  assert.equal(h.server.invoices.size, 1);
  assert.equal(h.state.entries[0]?.result?.invoiceId, 'inv-s1');
});

test('with no signal the queue stops at the first sale, and keeps its order', async () => {
  const h = harness({ faults: { 'draft:s1': ['network'] } });
  h.state = queue(queue(NO_FORWARDS, 1), 2);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(h.log, ['draft s1'], 'the second sale is not tried ahead of the first');
  assert.deepEqual(await h.sender.flush(), { sent: 2, refused: 0, stopped: false });
  assert.deepEqual(h.log.slice(1), ['draft s1', 'issue s1 k1', 'draft s2', 'issue s2 k2']);
});

test('a sale the server refuses is marked and left, and the next sale still goes', async () => {
  const h = harness({ faults: { 'draft:s1': [{ status: 422 }] } });
  h.state = queue(queue(NO_FORWARDS, 1), 2);
  assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 1, stopped: false });
  const [a, b] = h.state.entries;
  assert.equal(a?.problem?.kind, 'refused');
  assert.equal(a?.inDoubt, false);
  assert.equal(forwardWords(a!, 9000), 'refused');
  assert.ok(b?.result);
  const before = h.log.length;
  await h.sender.flush();
  assert.equal(h.log.length, before, 'a refused sale is not sent over and over');
});

test('a draft closed on the server is a conflict, not something to try again', async () => {
  for (const [step, status] of [['issue', 423], ['issue', 409], ['draft', 409]] as const) {
    const h = harness({ faults: { [`${step}:s1`]: [{ status }] } });
    h.state = queue(NO_FORWARDS, 1);
    assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 1, stopped: false }, `${step} ${status}`);
    assert.equal(h.state.entries[0]?.problem?.kind, 'conflict');
    await h.sender.flush();
    assert.equal(h.log.filter((line) => line.startsWith(step)).length, 1, 'not asked again');
  }
});

test('a shop switched off for now is waited out, not refused', async () => {
  const h = harness({ faults: { 'issue:s1': [{ status: 423, type: 'urn:problem:tenant-not-active' }] } });
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.equal(h.state.entries[0]?.problem, null);
  assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false });
});

test('an answer the app cannot read is marked, kept in doubt, and not sent again', async () => {
  for (const step of ['draft', 'issue'] as const) {
    const h = harness({ faults: { [`${step}:s1`]: ['garbage'] } });
    h.state = queue(NO_FORWARDS, 1);
    assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 1, stopped: false }, step);
    const entry = h.state.entries[0]!;
    assert.equal(entry.problem?.kind, 'unreadable');
    assert.equal(entry.inDoubt, true, 'the server may have the sale');
    assert.deepEqual(discardForward(h.state, 's1'), { ok: false, why: 'in_doubt' });
    const before = h.log.length;
    await h.sender.flush();
    assert.equal(h.log.length, before);
  }
});

test('a draft the server says is cancelled is a conflict', async () => {
  const h = harness({ faults: { 'draft:s1': ['cancelled_draft'] } });
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 1, stopped: false });
  assert.equal(h.state.entries[0]?.problem?.kind, 'conflict');
  assert.equal(h.log.some((line) => line.startsWith('issue')), false);
});

test('only the person who made a sale sends it', async () => {
  const h = harness();
  h.state = queue(queue(NO_FORWARDS, 1, 'u2'), 2);
  assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['draft s2', 'issue s2 k2']);
  assert.equal(h.state.entries[0]?.result, null);
  assert.equal(leftByOthers(h.state, 'u1'), 1);
});

test('one sender at a time: asking to send while sending joins the pass, and a sale queued meanwhile is not missed', async () => {
  const h = harness({
    onDraft: (entry) => {
      if (entry.id === 's1') {
        h.state = queue(h.state, 2);
        void h.sender.flush();
      }
    },
  });
  h.state = queue(NO_FORWARDS, 1);
  const first = h.sender.flush();
  const second = h.sender.flush();
  assert.equal(first, second, 'the same pass');
  const report = await first;
  assert.equal(report.sent, 2);
  assert.equal(h.mostBusy, 1, 'never two requests at once');
  assert.deepEqual(h.log, ['draft s1', 'issue s1 k1', 'draft s2', 'issue s2 k2']);
});

test('a sale taken off the list while its draft was on the way is not sent on', async () => {
  const h = harness({
    onDraft: (entry) => {
      const gone = discardForward(h.state, entry.id, { sure: true });
      assert.ok(gone.ok);
      h.state = gone.state;
    },
  });
  h.state = queue(queue(NO_FORWARDS, 1), 2);
  const report = await h.sender.flush();
  assert.equal(h.state.entries.length, 0, 'both were taken off as their drafts went out');
  assert.equal(report.sent, 0);
  assert.equal(h.log.some((line) => line.startsWith('issue')), false);
});

test('nothing waiting, or nothing kept yet, is a quiet pass', async () => {
  const h = harness();
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: false });
  const none = createForwardSender({ ...h.deps, read: () => null });
  assert.deepEqual(await none.flush(), { sent: 0, refused: 0, stopped: false });
});

test('a request goes out only after the note that it is going has been written down', async () => {
  const h = harness();
  h.state = queue(NO_FORWARDS, 1);
  const order: string[] = [];
  const sender = createForwardSender({
    ...h.deps,
    change: (change) => {
      h.deps.change(change);
      order.push('note');
    },
    saved: async () => {
      order.push('written');
      return true;
    },
    makeDraft: async (entry) => {
      order.push('draft');
      return h.deps.makeDraft(entry);
    },
    issue: async (entry) => {
      order.push('issue');
      return h.deps.issue(entry);
    },
  });
  assert.deepEqual(await sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(order.slice(0, 3), ['note', 'written', 'draft']);
  assert.deepEqual(order.filter((step) => step === 'written' || step === 'draft' || step === 'issue'), ['written', 'draft', 'written', 'issue']);
});

test('with no way to write the note down, nothing is sent, and the sale goes on the next pass', async () => {
  const h = harness();
  h.state = queue(NO_FORWARDS, 1);
  const stuck = createForwardSender({ ...h.deps, saved: async () => false });
  assert.deepEqual(await stuck.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(h.log, []);
  assert.equal(h.state.entries[0]?.result, null);
  const later = createForwardSender({ ...h.deps, saved: async () => true });
  assert.deepEqual(await later.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['draft s1', 'issue s1 k1']);
});

test('a note that cannot be written before the invoice step stops there, with the draft already made', async () => {
  const h = harness();
  h.state = queue(NO_FORWARDS, 1);
  let calls = 0;
  const sender = createForwardSender({ ...h.deps, saved: async () => (calls += 1) === 1 });
  assert.deepEqual(await sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(h.log, ['draft s1']);
  assert.equal(h.state.entries[0]?.draftId, 'd-s1');
  assert.deepEqual(await createForwardSender(h.deps).flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['draft s1', 'issue s1 k1']);
});

test('a sale that was refused or sent some other way while its draft was on the way is not asked for again', async () => {
  for (const settled of ['refused', 'sent'] as const) {
    const h = harness({
      onDraft: () => {
        h.state = {
          entries: h.state.entries.map((entry) =>
            settled === 'refused'
              ? { ...entry, problem: { kind: 'refused' as const, status: 422, words: 'No.' } }
              : { ...entry, result: { draftId: 'd-s1', invoiceId: 'inv-x', counterNumber: 1, code: null, totalCents: null, status: 'issued' } }
          ),
        };
      },
    });
    h.state = queue(NO_FORWARDS, 1);
    await h.sender.flush();
    assert.deepEqual(h.log, ['draft s1'], `no invoice is asked for once the sale is ${settled}`);
  }
});

test('a sale queued just as a pass finds nothing left is sent by one more pass, not left for the next', async () => {
  const h = harness();
  let late = false;
  const sender: ForwardSender = createForwardSender({
    ...h.deps,
    read: () => {
      const state = h.deps.read();
      if (state && state.entries.length === 0 && !late) {
        late = true;
        h.state = queue(NO_FORWARDS, 1);
        void sender.flush();
      }
      return state;
    },
  });
  assert.deepEqual(await sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['draft s1', 'issue s1 k1']);
});

// ---------------------------------------------------------------------------------------------
// Looking at what is open at the server before a sale's draft is made
// ---------------------------------------------------------------------------------------------

type OpenDraft = { id: string; clientDraftId: string | null; status: string; /** Who made it: this person unless said. `null`: the server does not say. */ createdBy?: string | null };
type Looking = { list?: Fault[]; read?: Fault[]; cancel?: Fault[]; staleList?: boolean; onList?: () => void };

/** The same server, with a way to look at the drafts that are open: some that were there before the phone came, and the phone's own that are not closed. */
function lookAtOpen(h: ReturnType<typeof harness>, before: OpenDraft[] = [], options: Looking = {}) {
  const others = new Map(before.map((draft) => [draft.id, { ...draft }]));
  const own = (): OpenDraft[] => [...h.server.drafts.entries()].map(([key, draft]) => ({ id: draft.id, clientDraftId: draftName(key), status: draft.status }));
  const all = (): OpenDraft[] => [...others.values(), ...own()];
  function raise(fault: Fault | undefined): void {
    if (fault === 'network') throw new TypeError('Network request failed');
    if (typeof fault === 'object') throw new ApiError('no', { status: fault.status });
  }
  h.deps.openDrafts = {
    list: async (entry) => {
      h.log.push(`list ${entry.id}`);
      options.onList?.();
      await Promise.resolve();
      const fault = options.list?.shift();
      raise(fault);
      if (fault === 'garbage') return { hello: 'world' };
      return { drafts: all().filter((draft) => options.staleList || draft.status === 'building').map((draft) => ({ id: draft.id, status: options.staleList ? 'building' : draft.status })) };
    },
    read: async (id) => {
      h.log.push(`read ${id}`);
      await Promise.resolve();
      const fault = options.read?.shift();
      raise(fault);
      if (fault === 'garbage') return 'not json';
      const draft = all().find((candidate) => candidate.id === id);
      if (!draft) throw new ApiError('gone', { status: 404 });
      return { id: draft.id, clientDraftId: draft.clientDraftId, status: draft.status, ...(draft.createdBy === null ? {} : { createdBy: draft.createdBy ?? 'u1' }) };
    },
    cancel: async (id) => {
      h.log.push(`cancel ${id}`);
      await Promise.resolve();
      raise(options.cancel?.shift());
      const target = [...h.server.drafts.values()].find((draft) => draft.id === id) ?? others.get(id);
      if (!target) throw new ApiError('gone', { status: 404 });
      if (target.status !== 'building') throw new ApiError('locked', { status: 423 });
      target.status = 'cancelled';
      return { id, status: 'cancelled' };
    },
  };
  return { others };
}

const WEB_DRAFT = '3f2b8c1e-1111-4222-8333-944455556666';
const left = (id: string, from = 'x1'): OpenDraft => ({ id, clientDraftId: draftName(from), status: 'building' });

test('the first time a sale goes, the server is asked what is open, and a clear answer lets it through', async () => {
  const h = harness();
  lookAtOpen(h);
  h.state = queue(queue(NO_FORWARDS, 1), 2);
  assert.deepEqual(await h.sender.flush(), { sent: 2, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['list s1', 'draft s1', 'issue s1 k1', 'list s2', 'draft s2', 'issue s2 k2'], 'a sale that was sent is not open any more');
});

test('a draft this phone left open is cancelled before a new sale\'s draft is made', async () => {
  const h = harness();
  const { others } = lookAtOpen(h, [left('old')]);
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['list s1', 'read old', 'cancel old', 'draft s1', 'issue s1 k1']);
  assert.equal(others.get('old')?.status, 'cancelled');
});

test('up to three drafts left open are cleared; more than that is not something the phone sorts out', async () => {
  const three = harness();
  lookAtOpen(three, [left('a', 'xa'), left('b', 'xb'), left('c', 'xc')]);
  three.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await three.sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(three.log, ['list s1', 'read a', 'cancel a', 'read b', 'cancel b', 'read c', 'cancel c', 'draft s1', 'issue s1 k1']);

  const four = harness();
  const { others } = lookAtOpen(four, [left('a', 'xa'), left('b', 'xb'), left('c', 'xc'), left('d', 'xd')]);
  four.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await four.sender.flush(), { sent: 0, refused: 1, stopped: false });
  assert.deepEqual(four.log, ['list s1'], 'none is read, none is cancelled');
  assert.deepEqual(four.state.entries[0]?.problem, OPEN_ELSEWHERE);
  assert.deepEqual([...others.values()].map((draft) => draft.status), ['building', 'building', 'building', 'building']);
});

test('a web counter draft open for the same person is left alone, and the phone sale still goes (GS2)', async () => {
  for (const clientDraftId of [WEB_DRAFT, null, '', 'phone:']) {
    const h = harness();
    const { others } = lookAtOpen(h, [{ id: 'web1', clientDraftId, status: 'building' }]);
    h.state = queue(NO_FORWARDS, 1);
    assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false }, String(clientDraftId));
    assert.deepEqual(h.log, ['list s1', 'read web1', 'draft s1', 'issue s1 k1'], String(clientDraftId));
    assert.equal(others.get('web1')?.status, 'building', 'the web draft is not cancelled');
  }
});

test('two phone sales still go while a web draft sits open', async () => {
  const h = harness();
  lookAtOpen(h, [{ id: 'web1', clientDraftId: WEB_DRAFT, status: 'building' }]);
  h.state = queue(queue(NO_FORWARDS, 1), 2);
  assert.deepEqual(await h.sender.flush(), { sent: 2, refused: 0, stopped: false });
  assert.equal(h.server.drafts.size, 2);
  assert.equal(h.server.invoices.size, 2);
});

test('a draft that cannot be read, or that this person may not look at or cancel, holds the sale back', async () => {
  const cases: Array<[string, Looking]> = [
    ['unreadable', { read: ['garbage'] }],
    ['read forbidden', { read: [{ status: 403 }] }],
    ['cancel forbidden', { cancel: [{ status: 403 }] }],
    ['cancel refused', { cancel: [{ status: 409 }] }],
  ];
  for (const [why, options] of cases) {
    const h = harness();
    lookAtOpen(h, [left('old')], options);
    h.state = queue(NO_FORWARDS, 1);
    assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 1, stopped: false }, why);
    assert.deepEqual(h.state.entries[0]?.problem, OPEN_ELSEWHERE, why);
    assert.equal(h.log.some((line) => line.startsWith('draft')), false, why);
  }
});

test('with no answer while looking, the sale waits and nothing is changed, and it goes when the line is back', async () => {
  const cases: Array<[string, Looking]> = [
    ['list', { list: ['network'] }],
    ['read', { read: ['network'] }],
    ['cancel', { cancel: ['network'] }],
    ['a busy server', { read: [{ status: 503 }] }],
  ];
  for (const [where, options] of cases) {
    const h = harness();
    lookAtOpen(h, [left('old')], options);
    h.state = queue(NO_FORWARDS, 1);
    assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true }, where);
    const waiting = h.state.entries[0]!;
    assert.deepEqual([waiting.sentAt, waiting.inDoubt, waiting.problem, waiting.draftId], [null, false, null, null], where);
    assert.equal(h.log.some((line) => line.startsWith('draft')), false, where);
    assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false }, where);
  }
});

test('a draft that is gone, or already closed, when it is read or cancelled needs nothing more', async () => {
  const cases: Array<[string, Looking]> = [
    ['gone when read', { read: [{ status: 404 }] }],
    ['locked when cancelled', { cancel: [{ status: 423 }] }],
    ['gone when cancelled', { cancel: [{ status: 404 }] }],
  ];
  for (const [why, options] of cases) {
    const h = harness();
    lookAtOpen(h, [left('old')], options);
    h.state = queue(NO_FORWARDS, 1);
    assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false }, why);
  }
  // Closed between the list and the read: it is passed over, whoever's it was.
  for (const clientDraftId of [WEB_DRAFT, draftName('x1')]) {
    const h = harness();
    lookAtOpen(h, [{ id: 'old', clientDraftId, status: 'issued' }], { staleList: true });
    h.state = queue(NO_FORWARDS, 1);
    assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false });
    assert.deepEqual(h.log, ['list s1', 'read old', 'draft s1', 'issue s1 k1'], 'nothing to cancel');
  }
});

test('a list that cannot be used does not hold the sale: the answer to the draft is checked as well', async () => {
  const cases: Array<[string, Looking]> = [
    ['forbidden', { list: [{ status: 403 }] }],
    ['not found', { list: [{ status: 404 }] }],
    ['refused', { list: [{ status: 400 }] }],
    ['not a list', { list: ['garbage'] }],
  ];
  for (const [why, options] of cases) {
    const h = harness();
    lookAtOpen(h, [], options);
    h.state = queue(NO_FORWARDS, 1);
    assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false }, why);
    assert.deepEqual(h.log, ['list s1', 'draft s1', 'issue s1 k1'], why);
  }
  const waits = harness();
  lookAtOpen(waits, [], { list: ['network'] });
  waits.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await waits.sender.flush(), { sent: 0, refused: 0, stopped: true }, 'but no answer at all is waited out');
});

test('a sale asked for again after a lost answer is not looked up again: the server finds its draft by name', async () => {
  const h = harness({ faults: { 'draft:s1': ['lose_answer'] } });
  lookAtOpen(h);
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['list s1', 'draft s1', 'draft s1', 'issue s1 k1']);
});

test('a sale taken off the list, or marked, while the server was being asked is not sent on', async () => {
  const gone = harness();
  lookAtOpen(gone, [], {
    onList: () => {
      const result = discardForward(gone.state, 's1');
      if (result.ok) gone.state = result.state;
    },
  });
  gone.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await gone.sender.flush(), { sent: 0, refused: 0, stopped: false });
  assert.deepEqual(gone.log, ['list s1']);
  assert.equal(gone.state.entries.length, 0);

  for (const settled of ['refused', 'sent'] as const) {
    const h = harness();
    lookAtOpen(h, [], {
      onList: () => {
        h.state = {
          entries: h.state.entries.map((entry) =>
            settled === 'refused'
              ? { ...entry, problem: { kind: 'refused' as const, status: 422, words: 'No.' } }
              : { ...entry, result: { draftId: 'd-s1', invoiceId: 'inv-x', counterNumber: 1, code: null, totalCents: null, status: 'issued' } }
          ),
        };
      },
    });
    h.state = queue(NO_FORWARDS, 1);
    await h.sender.flush();
    assert.deepEqual(h.log, ['list s1'], `nothing is made for a sale that is ${settled}`);
  }
});

test('a draft the server made out of another, open sale is not issued, and the sale is kept in doubt', async () => {
  const h = harness({ faults: { 'draft:s1': ['merge'] } });
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 1, stopped: false });
  const entry = h.state.entries[0]!;
  assert.deepEqual(entry.problem, MIXED_IN);
  assert.equal(entry.inDoubt, true, 'its lines are in the other sale now');
  assert.equal(entry.draftId, null);
  assert.deepEqual(h.log, ['draft s1'], 'the other sale is never issued');
  assert.deepEqual(discardForward(h.state, 's1'), { ok: false, why: 'in_doubt' });
});

test('a sale the server refuses at the invoice step has its draft cancelled, so the next sale is not mixed into it', async () => {
  const h = harness({ faults: { 'issue:s1': [{ status: 400 }] } });
  lookAtOpen(h);
  h.state = queue(queue(NO_FORWARDS, 1), 2);
  assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 1, stopped: false });
  assert.deepEqual(h.log, ['list s1', 'draft s1', 'issue s1 k1', 'cancel d-s1', 'list s2', 'draft s2', 'issue s2 k2']);
  assert.equal(h.server.drafts.get('s1')?.status, 'cancelled');
  assert.equal(h.state.entries[0]?.problem?.kind, 'refused');
});

test('when that cancel gets no answer the sale is still refused, and the next sale clears the leftover itself', async () => {
  const h = harness({ faults: { 'issue:s1': [{ status: 400 }] } });
  lookAtOpen(h, [], { cancel: ['network'] });
  h.state = queue(queue(NO_FORWARDS, 1), 2);
  assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 1, stopped: false });
  assert.deepEqual(h.log, ['list s1', 'draft s1', 'issue s1 k1', 'cancel d-s1', 'list s2', 'read d-s1', 'cancel d-s1', 'draft s2', 'issue s2 k2']);
  assert.equal(h.server.drafts.get('s1')?.status, 'cancelled');
});

test('a sale whose invoice was asked for and got no readable answer is not cancelled: the server may have made it', async () => {
  for (const fault of ['lose_answer', 'garbage'] as const) {
    const h = harness({ faults: { 'issue:s1': [fault] } });
    lookAtOpen(h);
    h.state = queue(NO_FORWARDS, 1);
    await h.sender.flush();
    assert.equal(h.log.some((line) => line.startsWith('cancel')), false, fault);
    assert.equal(h.server.invoices.size, 1, fault);
  }
});

test('without a way to look, a sale is made as it was, and nothing is cancelled', async () => {
  const h = harness({ faults: { 'issue:s1': [{ status: 400 }] } });
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 1, stopped: false });
  assert.deepEqual(h.log, ['draft s1', 'issue s1 k1']);
});

test('not found is the shop having drafts switched off at the draft step, and a draft that is gone at the invoice step', async () => {
  const off = harness({ faults: { 'draft:s1': [{ status: 404 }] } });
  off.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await off.sender.flush(), { sent: 0, refused: 1, stopped: false });
  assert.deepEqual(off.state.entries[0]?.problem, DRAFTS_OFF);
  assert.equal(off.state.entries[0]?.inDoubt, false);

  const gone = harness({ faults: { 'issue:s1': [{ status: 404 }] } });
  gone.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await gone.sender.flush(), { sent: 0, refused: 1, stopped: false });
  assert.deepEqual(gone.state.entries[0]?.problem, DRAFT_GONE);
});

// ---------------------------------------------------------------------------------------------
// Whose a draft is, and whether this sender is still the signed-in person's
// ---------------------------------------------------------------------------------------------

test('a draft with this phone\'s name that someone else made is left alone, and so is one whose maker the server does not say', async () => {
  for (const createdBy of ['u2', null]) {
    const h = harness();
    const { others } = lookAtOpen(h, [{ ...left('theirs'), createdBy }]);
    h.state = queue(NO_FORWARDS, 1);
    assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 1, stopped: false }, String(createdBy));
    assert.deepEqual(h.state.entries[0]?.problem, OPEN_ELSEWHERE, String(createdBy));
    assert.equal(others.get('theirs')?.status, 'building', 'it was not cancelled');
    assert.deepEqual(h.log, ['list s1', 'read theirs'], 'and nothing was made for the sale');
  }
  const own = harness();
  const { others } = lookAtOpen(own, [{ ...left('mine'), createdBy: 'u1' }]);
  own.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await own.sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.equal(others.get('mine')?.status, 'cancelled', 'one this person made under this phone\'s name is cleared');
});

test('a sender that is no longer the signed-in person\'s asks the server for nothing and changes nothing', async () => {
  const h = harness();
  lookAtOpen(h, [left('old')]);
  h.deps.live = () => false;
  h.state = queue(queue(NO_FORWARDS, 1), 2);
  const before = h.state;
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(h.log, []);
  assert.equal(h.state, before, 'not even a note that a request was sent');
});

test('a sender that stops being the signed-in person\'s while it asks goes no further, and what it was waiting for is still written down', async () => {
  // During the draft: the draft that comes back is kept, the invoice and the next sale are not asked for.
  let alive = true;
  let first = true;
  const h = harness({
    onDraft: () => {
      if (first) alive = false;
      first = false;
    },
  });
  h.deps.live = () => alive;
  h.state = queue(queue(NO_FORWARDS, 1), 2);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(h.log, ['draft s1']);
  const waiting = h.state.entries[0]!;
  assert.deepEqual([waiting.draftId, waiting.inDoubt, waiting.result], ['d-s1', false, null]);
  assert.equal(h.state.entries[1]?.sentAt, null, 'the next sale was not touched');
  alive = true;
  assert.deepEqual(await h.sender.flush(), { sent: 2, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['draft s1', 'issue s1 k1', 'draft s2', 'issue s2 k2'], 'the next pass carries on where it stopped');

  // During the invoice: its answer is kept as sent, and the next sale is not started.
  let open = true;
  const g = harness();
  const issue = g.deps.issue;
  g.deps.issue = async (entry) => {
    open = false;
    return issue(entry);
  };
  g.deps.live = () => open;
  g.state = queue(queue(NO_FORWARDS, 1), 2);
  assert.deepEqual(await g.sender.flush(), { sent: 1, refused: 0, stopped: true });
  assert.deepEqual(g.log, ['draft s1', 'issue s1 k1']);
  assert.equal(g.state.entries[0]?.result?.invoiceId, 'inv-s1');
  assert.equal(g.state.entries[1]?.sentAt, null);
});

test('a sender that stops being the signed-in person\'s while it looks at the server does not read on, cancel, or make anything', async () => {
  let alive = true;
  const h = harness();
  lookAtOpen(h, [left('old')], { onList: () => { alive = false; } });
  h.deps.live = () => alive;
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(h.log, ['list s1']);
  const entry = h.state.entries[0]!;
  assert.deepEqual([entry.sentAt, entry.inDoubt, entry.problem, entry.draftId], [null, false, null, null]);

  // Between reading a leftover and cancelling it.
  let still = true;
  const g = harness();
  const { others } = lookAtOpen(g, [left('old')]);
  const read = g.deps.openDrafts!.read;
  g.deps.openDrafts!.read = async (id) => {
    const answer = await read(id);
    still = false;
    return answer;
  };
  g.deps.live = () => still;
  g.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await g.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(g.log, ['list s1', 'read old']);
  assert.equal(others.get('old')?.status, 'building');
});

test('a sale refused at the invoice step is not cleaned up by a sender that has gone', async () => {
  let open = true;
  const h = harness({ faults: { 'issue:s1': [{ status: 422 }] } });
  lookAtOpen(h);
  const issue = h.deps.issue;
  h.deps.issue = async (entry) => {
    open = false;
    return issue(entry);
  };
  h.deps.live = () => open;
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 1, stopped: true });
  assert.equal(h.log.some((line) => line.startsWith('cancel')), false, 'its draft is left for the next sender to clear');
  assert.equal(h.state.entries[0]?.problem?.kind, 'refused');
});

test('a sender that goes while it looks at the server and finds nothing open does not start the sale', async () => {
  let alive = true;
  const h = harness();
  lookAtOpen(h, [], { onList: () => { alive = false; } });
  h.deps.live = () => alive;
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(h.log, ['list s1']);
  const entry = h.state.entries[0]!;
  assert.deepEqual([entry.sentAt, entry.inDoubt, entry.draftId], [null, false, null], 'the sale was not marked as sent: it was not');
});

test('a sender that goes while the note that a request is going is written does not send it', async () => {
  // Before the draft.
  let alive = true;
  const h = harness();
  h.deps.saved = async () => {
    alive = false;
    return true;
  };
  h.deps.live = () => alive;
  h.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await h.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(h.log, [], 'no draft was asked for');
  assert.equal(h.state.entries[0]?.inDoubt, true, 'the note stays: the next sender asks again under the same name');
  alive = true;
  h.deps.saved = undefined;
  assert.deepEqual(await h.sender.flush(), { sent: 1, refused: 0, stopped: false });
  assert.deepEqual(h.log, ['draft s1', 'issue s1 k1']);

  // Before the invoice.
  let open = true;
  let writes = 0;
  const g = harness();
  g.deps.saved = async () => {
    writes += 1;
    if (writes === 2) open = false;
    return true;
  };
  g.deps.live = () => open;
  g.state = queue(NO_FORWARDS, 1);
  assert.deepEqual(await g.sender.flush(), { sent: 0, refused: 0, stopped: true });
  assert.deepEqual(g.log, ['draft s1'], 'the draft went, the invoice was not asked for');
  assert.equal(g.state.entries[0]?.draftId, 'd-s1');
});
