import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TYPED_CENTS, formatMoney, fromCents, lineCents, parseMoney, toCents, totalCents } from '../src/lib/money';

test('shillings from the server become whole cents, and back, without drifting', () => {
  assert.equal(toCents(450.5), 45050);
  assert.equal(toCents(19.99), 1999);
  assert.equal(toCents(0), 0);
  // The classic: these two do not add up in floating point, but they do in cents.
  assert.equal(0.1 + 0.2 === 0.3, false);
  assert.equal((toCents(0.1) ?? 0) + (toCents(0.2) ?? 0), toCents(0.3));
  assert.equal(fromCents(45050), 450.5);
  assert.equal(fromCents(5), 0.05);
  assert.equal(fromCents(0), 0);
});

test('an amount that is not a number has no cents', () => {
  assert.equal(toCents(NaN), null);
  assert.equal(toCents(Infinity), null);
  assert.equal(toCents(-Infinity), null);
});

test('amounts are shown with two decimals and thousands grouped', () => {
  assert.equal(formatMoney(0), '0.00');
  assert.equal(formatMoney(5), '0.05');
  assert.equal(formatMoney(100), '1.00');
  assert.equal(formatMoney(99999), '999.99');
  assert.equal(formatMoney(100000), '1,000.00');
  assert.equal(formatMoney(125050), '1,250.50');
  assert.equal(formatMoney(100000000), '1,000,000.00');
  assert.equal(formatMoney(-250), '-2.50');
  assert.equal(formatMoney(-125050), '-1,250.50');
});

test('what a person types is read as an amount', () => {
  assert.equal(parseMoney('1250'), 125000);
  assert.equal(parseMoney('1,250'), 125000);
  assert.equal(parseMoney('1,250.5'), 125050);
  assert.equal(parseMoney('1250.05'), 125005);
  assert.equal(parseMoney('.5'), 50);
  assert.equal(parseMoney('0.05'), 5);
  assert.equal(parseMoney('  300  '), 30000);
  assert.equal(parseMoney('0'), 0);
  assert.equal(parseMoney('1,000,000'), 100000000);
  assert.equal(parseMoney('007'), 700);
});

test('what is not an amount is refused rather than guessed at', () => {
  for (const typed of ['', ' ', 'abc', '-5', '5-', 'KES 5', '1e3', '1 250', '.', '1.', ',', '1.2.3', '12.345', '1,250,', '--']) {
    assert.equal(parseMoney(typed), null, JSON.stringify(typed));
  }
});

test('a comma is only ever a thousands separator, so "12,50" is not read as 1,250', () => {
  for (const typed of ['12,50', '1,25', '1,2500', '12,5', '1,250,00', ',250']) {
    assert.equal(parseMoney(typed), null, typed);
  }
});

test('an amount past ten million shillings is a slip, not a sale', () => {
  assert.equal(parseMoney('10,000,000'), MAX_TYPED_CENTS);
  assert.equal(parseMoney('10,000,000.01'), null);
  assert.equal(parseMoney('99999999999999999999'), null);
});

test('a basket line costs what the server charges: quantity times price, rounded half up to the cent', () => {
  assert.equal(lineCents(3, 0.1), 30);
  assert.equal(lineCents(3, 19.99), 5997);
  assert.equal(lineCents(1, 450.5), 45050);
  // Half a cent rounds up, as the server's two-decimal rounding does.
  assert.equal(lineCents(0.5, 0.01), 1);
  assert.equal(lineCents(1.5, 0.01), 2);
  assert.equal(lineCents(1, 1.005), 101);
  // Weighed goods: 2.5 kg at 19.99 is 49.975, which rounds up to 49.98.
  assert.equal(lineCents(2.5, 19.99), 4998);
  assert.equal(lineCents(0.333, 45), 1499);
  // Just under a half stays down.
  assert.equal(lineCents(0.499, 0.01), 0);
});

test('a free item costs nothing, but a line with no usable quantity or price has no cost', () => {
  assert.equal(lineCents(2, 0), 0);
  assert.equal(lineCents(0, 5), null);
  assert.equal(lineCents(-1, 5), null);
  assert.equal(lineCents(1, -5), null);
  assert.equal(lineCents(NaN, 5), null);
  assert.equal(lineCents(1, NaN), null);
  assert.equal(lineCents(Infinity, 5), null);
  assert.equal(lineCents(1, Infinity), null);
});

test('an absurd line is refused, not silently wrapped', () => {
  assert.equal(lineCents(1e12, 1e12), null);
});

test('a basket totals in cents, and a bad line stops the whole total', () => {
  assert.equal(totalCents([]), 0);
  assert.equal(totalCents([{ quantity: 1, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 }]), 30);
  assert.equal(
    totalCents([
      { quantity: 2, unitPrice: 120 },
      { quantity: 1, unitPrice: 49.5 },
      { quantity: 0.5, unitPrice: 33 },
    ]),
    24000 + 4950 + 1650
  );
  assert.equal(totalCents([{ quantity: 1, unitPrice: 10 }, { quantity: 1, unitPrice: NaN }]), null);
  assert.equal(totalCents([{ quantity: 0, unitPrice: 10 }]), null);
});
