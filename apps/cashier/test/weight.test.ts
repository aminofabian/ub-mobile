import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatKg,
  howToSell,
  kgToThousandths,
  MAX_WEIGHT_THOUSANDTHS,
  parseWeightKg,
  previewWeighedLine,
  thousandthsToKg,
  weightProblemWords,
  type WeightProblem,
} from '../src/lib/weight';

test('a weight is read to the gram', () => {
  assert.deepEqual(parseWeightKg('1.25'), { ok: true, thousandths: 1250 });
  assert.deepEqual(parseWeightKg('2'), { ok: true, thousandths: 2000 });
  assert.deepEqual(parseWeightKg('0.125'), { ok: true, thousandths: 125 });
  assert.deepEqual(parseWeightKg('.5'), { ok: true, thousandths: 500 });
  assert.deepEqual(parseWeightKg('1.'), { ok: true, thousandths: 1000 });
  assert.deepEqual(parseWeightKg('  0.3  '), { ok: true, thousandths: 300 });
  assert.deepEqual(parseWeightKg('007.5'), { ok: true, thousandths: 7500 });
  assert.deepEqual(parseWeightKg('0.001'), { ok: true, thousandths: 1 });
});

test('zeros after the third decimal say nothing more, any other digit there is refused', () => {
  assert.deepEqual(parseWeightKg('1.2500'), { ok: true, thousandths: 1250 });
  assert.deepEqual(parseWeightKg('1.250000000'), { ok: true, thousandths: 1250 });
  assert.deepEqual(parseWeightKg('1.2501'), { ok: false, problem: 'too_many_decimals' });
  assert.deepEqual(parseWeightKg('0.0005'), { ok: false, problem: 'too_many_decimals' });
});

test('anything that is not a plain weight is refused, and a comma is never a decimal mark', () => {
  const refused: [string, WeightProblem][] = [
    ['', 'empty'],
    ['   ', 'empty'],
    ['.', 'not_a_number'],
    ['abc', 'not_a_number'],
    ['1,25', 'not_a_number'],
    ['1,250', 'not_a_number'],
    ['-1', 'not_a_number'],
    ['+1', 'not_a_number'],
    ['1e3', 'not_a_number'],
    ['1.2.3', 'not_a_number'],
    ['1 5', 'not_a_number'],
    ['0x10', 'not_a_number'],
    ['Infinity', 'not_a_number'],
    ['0', 'zero'],
    ['0.000', 'zero'],
    ['.0', 'zero'],
  ];
  for (const [text, problem] of refused) {
    assert.deepEqual(parseWeightKg(text), { ok: false, problem }, JSON.stringify(text));
  }
});

test('a line cannot weigh more than 999.999 kg', () => {
  assert.deepEqual(parseWeightKg('999.999'), { ok: true, thousandths: MAX_WEIGHT_THOUSANDTHS });
  assert.deepEqual(parseWeightKg('1000'), { ok: false, problem: 'too_heavy' });
  assert.deepEqual(parseWeightKg('12500'), { ok: false, problem: 'too_heavy' });
  assert.deepEqual(parseWeightKg('1000.5'), { ok: false, problem: 'too_heavy' });
  assert.deepEqual(parseWeightKg('9'.repeat(5000)), { ok: false, problem: 'too_heavy' });
  assert.deepEqual(parseWeightKg(`${'0'.repeat(5000)}5`), { ok: true, thousandths: 5000 });
});

test('every problem has words, and they say what to do', () => {
  const problems: WeightProblem[] = ['empty', 'not_a_number', 'too_many_decimals', 'zero', 'too_heavy'];
  const seen = new Set<string>();
  for (const problem of problems) {
    const words = weightProblemWords(problem);
    assert.ok(words.length > 10, problem);
    seen.add(words);
  }
  assert.equal(seen.size, problems.length, 'each problem says its own thing');
  assert.match(weightProblemWords('too_heavy'), /999\.999/);
});

test('weights are shown the way a scale shows them', () => {
  assert.equal(formatKg(1250), '1.25 kg');
  assert.equal(formatKg(2000), '2 kg');
  assert.equal(formatKg(125), '0.125 kg');
  assert.equal(formatKg(1), '0.001 kg');
  assert.equal(formatKg(1005), '1.005 kg');
  assert.equal(formatKg(1050), '1.05 kg');
  assert.equal(formatKg(999_999), '999.999 kg');
  assert.equal(formatKg(0), '0 kg');
});

test('kilograms and thousandths convert both ways without drifting', () => {
  assert.equal(thousandthsToKg(1250), 1.25);
  assert.equal(thousandthsToKg(1), 0.001);
  assert.equal(String(thousandthsToKg(300 + 700)), '1');
  assert.equal(kgToThousandths(1.25), 1250);
  assert.equal(kgToThousandths(0.1 + 0.2), 300, '0.30000000000000004 kg is 300 g');
  assert.equal(kgToThousandths(0), null);
  assert.equal(kgToThousandths(-1), null);
  assert.equal(kgToThousandths(Number.NaN), null);
  assert.equal(kgToThousandths(1000), null, 'over the most a line may weigh');
  assert.equal(kgToThousandths(0.0004), null, 'under a gram');
  for (let grams = 1; grams <= 999_999; grams += 997) {
    assert.equal(kgToThousandths(thousandthsToKg(grams)), grams);
    assert.ok((String(thousandthsToKg(grams)).split('.')[1]?.length ?? 0) <= 3, `${grams} g stays at three decimals`);
  }
});

test('an item sold by the unit, by weight in kg, or not at all', () => {
  assert.deepEqual(howToSell({}), { kind: 'units' });
  assert.deepEqual(howToSell({ weighed: false, unitType: 'kg' }), { kind: 'units' }, 'a kg unit alone is not a weighed item');
  assert.deepEqual(howToSell({ weighed: true, unitType: 'kg' }), { kind: 'kg' });
  assert.deepEqual(howToSell({ weighed: true, unitType: ' KG ' }), { kind: 'kg' });
});

test('a weighed item the server would refuse is stopped at the till, with the reason', () => {
  const grams = howToSell({ weighed: true, unitType: 'g' });
  assert.equal(grams.kind, 'blocked');
  assert.match(grams.kind === 'blocked' ? grams.why : '', /per g\b.*kg only/);
  const pounds = howToSell({ weighed: true, unitType: 'lb' });
  assert.equal(pounds.kind, 'blocked');
  assert.match(pounds.kind === 'blocked' ? pounds.why : '', /per lb\b/);
  const pack = howToSell({ weighed: true, unitType: 'kg', packageVariant: true });
  assert.equal(pack.kind, 'blocked');
  assert.match(pack.kind === 'blocked' ? pack.why : '', /pack/);
  for (const unitType of [undefined, '', 'each', 'litre']) {
    const none = howToSell({ weighed: true, ...(unitType !== undefined ? { unitType } : {}) });
    assert.equal(none.kind, 'blocked', String(unitType));
    assert.match(none.kind === 'blocked' ? none.why : '', /no weight unit/);
  }
});

test('the weight prompt shows the line total as the server will count it, or what is wrong', () => {
  const ok = previewWeighedLine(450, '1.25');
  assert.deepEqual(ok, { ok: true, thousandths: 1250, weight: '1.25 kg', totalCents: 56250 });
  assert.deepEqual(previewWeighedLine(450, '0.333'), { ok: true, thousandths: 333, weight: '0.333 kg', totalCents: 14985 });
  assert.deepEqual(previewWeighedLine(333.33, '0.001'), { ok: true, thousandths: 1, weight: '0.001 kg', totalCents: 33 });
  assert.deepEqual(previewWeighedLine(450, ''), { ok: false, words: weightProblemWords('empty') });
  assert.deepEqual(previewWeighedLine(450, '1,5'), { ok: false, words: weightProblemWords('not_a_number') });
  assert.deepEqual(previewWeighedLine(450, '1.2345'), { ok: false, words: weightProblemWords('too_many_decimals') });
  assert.deepEqual(previewWeighedLine(Number.NaN, '1'), { ok: false, words: 'This item has no usable price.' });
});

test('a weight in grams that is not whole is rounded to the gram, not cut', async () => {
  const { thousandthsToKg } = await import('../src/lib/weight');
  assert.equal(thousandthsToKg(1249.6), 1.25);
  assert.equal(thousandthsToKg(1250.4), 1.25);
});
