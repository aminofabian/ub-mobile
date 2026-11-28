import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ARRIVAL_AS_ORDERED,
  ARRIVAL_DAMAGED,
  ARRIVAL_MISSING,
  ARRIVAL_SHORT,
  PUT_AWAY_STOCK,
  PUT_AWAY_STORE,
  planPutAway as phonePlan,
  type ArrivalDecision,
  type PutAwayDestination,
} from '../src/lib/receive-arrival';

const webUrl = pathToFileURL(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../frontend/app/(dashboard)/order/_lib/receive-arrival.ts')
).href;

type WebPlan = { stockLineIds: string[]; storeLines: { id: string; qty: number }[] };
type WebPutAway = (
  openLineIds: readonly string[],
  decisions: Record<string, ArrivalDecision | undefined>,
  qtyByLine: Record<string, number>,
  destByLine: Record<string, PutAwayDestination>,
  fallback?: PutAwayDestination
) => WebPlan;

const cases: {
  name: string;
  ids: string[];
  decisions: Record<string, ArrivalDecision | undefined>;
  qty: Record<string, number>;
  dest: Record<string, PutAwayDestination>;
}[] = [
  {
    name: 'missing and damaged stay off both destinations',
    ids: ['ok', 'short', 'gone', 'hurt', 'blank'],
    decisions: {
      ok: ARRIVAL_AS_ORDERED,
      short: ARRIVAL_SHORT,
      gone: ARRIVAL_MISSING,
      hurt: ARRIVAL_DAMAGED,
    },
    qty: { ok: 10, short: 4, gone: 0, hurt: 2, blank: 3 },
    dest: { short: PUT_AWAY_STORE },
  },
  {
    name: 'a zero count does not move, and an unnamed destination goes to the shelf',
    ids: ['a', 'b', 'c'],
    decisions: { a: ARRIVAL_AS_ORDERED, b: ARRIVAL_SHORT, c: ARRIVAL_AS_ORDERED },
    qty: { a: 3, b: 0, c: 1 },
    dest: { a: PUT_AWAY_STOCK, c: PUT_AWAY_STORE },
  },
];

test('the phone and the web send the same lines to the shelf and the store room', async () => {
  const web = (await import(webUrl)) as { planPutAway: WebPutAway };
  for (const sample of cases) {
    const phone = phonePlan(sample.ids, sample.decisions, sample.qty, sample.dest);
    const desk = web.planPutAway(sample.ids, sample.decisions, sample.qty, sample.dest);
    assert.deepEqual(
      phone.storeLines,
      desk.storeLines,
      sample.name
    );
    assert.deepEqual(
      phone.stockLines.map((line) => line.id),
      desk.stockLineIds,
      sample.name
    );
    for (const line of phone.stockLines) {
      assert.equal(line.qty, sample.qty[line.id], sample.name);
    }
  }
});

test('only the web can send a whole pass to the store room when a line names no destination', async () => {
  const web = (await import(webUrl)) as { planPutAway: WebPutAway };
  const ids = ['a'];
  const decisions = { a: ARRIVAL_AS_ORDERED };
  const qty = { a: 2 };
  const phone = phonePlan(ids, decisions, qty, {});
  const desk = web.planPutAway(ids, decisions, qty, {}, PUT_AWAY_STORE);
  assert.deepEqual(phone.stockLines, [{ id: 'a', qty: 2 }]);
  assert.deepEqual(phone.storeLines, []);
  assert.deepEqual(desk.stockLineIds, []);
  assert.deepEqual(desk.storeLines, [{ id: 'a', qty: 2 }]);
});
