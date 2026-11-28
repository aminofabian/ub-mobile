import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FACTS_MAX_AGE_MS,
  factsFrom,
  knownShop,
  parseFacts,
  stillWaitingForShop,
  usableFacts,
  WAIT_FOR_SHOP_MS,
} from '../src/lib/checkout-facts';

const NOW = new Date('2026-11-23T09:00:00.000Z');
const AREAS = [
  { name: 'Kilimani', active: true },
  { name: 'Karen', active: false },
];

test('what the shop said is kept as the areas it delivers to and whether it takes M-Pesa online', () => {
  assert.deepEqual(factsFrom(AREAS, { online: [{}], manual: [] }, NOW), {
    areas: ['Kilimani'],
    hasOnlinePay: true,
    hasManualPay: false,
    savedAt: NOW.toISOString(),
  });
  assert.equal(factsFrom(AREAS, { online: [], manual: [{}] }, NOW)?.hasManualPay, true);
});

test('nothing is kept from a shop that did not answer, so a missing list is never read as "delivers nowhere"', () => {
  assert.equal(factsFrom(undefined, { online: [] }, NOW), null);
  assert.equal(factsFrom(AREAS, undefined, NOW), null);
  assert.equal(factsFrom(null, null, NOW), null);
});

test('an answer about areas without one about payment is not kept as a shop that takes no payment', () => {
  assert.equal(factsFrom(AREAS, { online: null, manual: null }, NOW), null);
  assert.equal(factsFrom(AREAS, {}, NOW), null);
  assert.equal(factsFrom(AREAS, { online: [] }, NOW)?.hasOnlinePay, false, 'an answer with an empty list is an answer');
  assert.equal(factsFrom(AREAS, { manual: [{}] }, NOW)?.hasManualPay, true);
});

test('a shop that answered with no areas is kept as delivering nowhere', () => {
  assert.deepEqual(factsFrom([], { online: [] }, NOW)?.areas, []);
});

test('what is read back is what was kept, and damaged data is nothing', () => {
  const facts = factsFrom(AREAS, { online: [{}] }, NOW)!;
  assert.deepEqual(parseFacts(JSON.stringify(facts)), facts);
  assert.equal(parseFacts(null), null);
  assert.equal(parseFacts('nope'), null);
  assert.equal(parseFacts('{"areas":"Kilimani","savedAt":"2026-11-23T09:00:00.000Z"}'), null);
  assert.equal(parseFacts('{"areas":[],"savedAt":"yesterday"}'), null);
  assert.deepEqual(parseFacts('{"areas":["A",3,"  "],"savedAt":"2026-11-23T09:00:00.000Z"}')?.areas, ['A']);
});

test('what was kept is trusted for two weeks, and not after, nor from the future', () => {
  const facts = factsFrom(AREAS, { online: [] }, NOW)!;
  const later = (ms: number) => new Date(NOW.getTime() + ms);
  assert.ok(usableFacts(facts, NOW));
  assert.ok(usableFacts(facts, later(FACTS_MAX_AGE_MS)));
  assert.equal(usableFacts(facts, later(FACTS_MAX_AGE_MS + 1)), null);
  assert.equal(usableFacts(facts, later(-1)), null);
  assert.equal(usableFacts(null, NOW), null);
});

test('the shop\'s own answer wins, and the phone fills in only what the shop did not say', () => {
  const kept = factsFrom([{ name: 'Karen', active: true }], { online: [] }, NOW)!;
  assert.deepEqual(knownShop({ areas: AREAS, online: [{}] }, kept), { areaNames: ['Kilimani'], hasOnlinePay: true, fromPhone: false });
  assert.deepEqual(knownShop(undefined, kept), { areaNames: ['Karen'], hasOnlinePay: false, fromPhone: true });
  assert.deepEqual(knownShop({ areas: AREAS }, kept), { areaNames: ['Kilimani'], hasOnlinePay: false, fromPhone: false });
  assert.deepEqual(knownShop(undefined, null), { areaNames: null, hasOnlinePay: null, fromPhone: false });
});

test('each answer is used as it comes, and what the shop did not say is taken from what was kept', () => {
  const kept = factsFrom([{ name: 'Karen', active: true }], { online: [{}], manual: [] }, NOW)!;
  assert.deepEqual(knownShop({ areas: null, online: [] }, kept), { areaNames: ['Karen'], hasOnlinePay: false, fromPhone: true });
  assert.deepEqual(knownShop({ areas: AREAS, online: null }, kept), { areaNames: ['Kilimani'], hasOnlinePay: true, fromPhone: false });
  assert.deepEqual(knownShop({ areas: null, online: [{}] }, null), { areaNames: null, hasOnlinePay: true, fromPhone: false });
  assert.deepEqual(knownShop({ areas: AREAS, online: null }, null), { areaNames: ['Kilimani'], hasOnlinePay: null, fromPhone: false });
});

test('the form waits for the shop only while there is nothing to go on, and not for ever', () => {
  const base = { anyAnswer: false, kept: false, keptRead: true, asking: true, waitedTooLong: false };
  assert.equal(stillWaitingForShop(base), true, 'asking, nothing kept');
  assert.equal(stillWaitingForShop({ ...base, keptRead: false, asking: false }), true, 'the phone\'s copy is not read yet');
  assert.equal(stillWaitingForShop({ ...base, asking: false }), false, 'asked and nothing came: it says what it does not know');
  assert.equal(stillWaitingForShop({ ...base, kept: true }), false, 'a copy on the phone is something to go on');
  assert.equal(stillWaitingForShop({ ...base, anyAnswer: true }), false, 'one answer is something to go on');
  assert.equal(stillWaitingForShop({ ...base, waitedTooLong: true }), false, 'a patience that ran out');
  assert.equal(stillWaitingForShop({ ...base, keptRead: false, waitedTooLong: true }), false, 'even before the copy is read');
  assert.ok(WAIT_FOR_SHOP_MS >= 3_000 && WAIT_FOR_SHOP_MS <= 15_000, 'long enough for a slow answer, short enough not to look stuck');
});

test('what was kept is trusted for fourteen days, not fifteen', () => {
  const facts = factsFrom([{ name: 'Kilimani', active: true }], { online: [{}], manual: [] }, NOW);
  assert.ok(facts);
  const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
  assert.ok(usableFacts(facts, days(13)));
  assert.equal(usableFacts(facts, days(15)), null);
});
