import assert from 'node:assert/strict';
import test from 'node:test';
import { centsToAmount, centsToTyped, kesOrDash, MAX_OWNER_CENTS, signedCents, typedCents } from '../src/lib/owner-money';

test('a figure from the server becomes whole cents, from a number or from text', () => {
  assert.equal(signedCents('1250.50'), 125050);
  assert.equal(signedCents(1250.5), 125050);
  assert.equal(signedCents('0'), 0);
  assert.equal(signedCents('  300 '), 30000);
  assert.equal(signedCents(0.07), 7);
  assert.equal(signedCents(1.15), 115);
  assert.equal(signedCents('12.3'), 1230);
  assert.equal(signedCents('7'), 700);
});

test('a third decimal rounds half up, so 1.005 is 101 cents and 1.004 is 100', () => {
  assert.equal(signedCents('1.005'), 101);
  assert.equal(signedCents('1.004'), 100);
  assert.equal(signedCents('1.0049999'), 100);
  assert.equal(signedCents('0.995'), 100);
  assert.equal(signedCents('0.994'), 99);
});

test('a loss keeps its sign, and a zero never turns into minus zero', () => {
  assert.equal(signedCents('-300.25'), -30025);
  assert.equal(signedCents(-0.5), -50);
  assert.ok(Object.is(signedCents('-0'), 0));
  assert.ok(Object.is(signedCents('-0.001'), 0));
  assert.ok(Object.is(signedCents(-0.0000001), 0));
});

test('anything that is not a plain amount is not known, and never zero', () => {
  const bad: unknown[] = [null, undefined, '', ' ', 'abc', '1,250.00', '12.', '.5', '1e5', '--5', '5-', '+5', Number.NaN, Infinity, -Infinity, {}, [], true, '1 000', '0x10', '1234567890123', '1.123456789'];
  for (const value of bad) assert.equal(signedCents(value), null, String(value));
});

test('a figure above what the screens believe in is not known', () => {
  assert.equal(signedCents('999999999.99'), MAX_OWNER_CENTS);
  assert.equal(signedCents('1000000000.00'), null);
  assert.equal(signedCents(999_999_999), 99_999_999_900);
  assert.equal(signedCents(1_000_000_000), null);
  assert.equal(signedCents(-1_000_000_000), null);
  assert.equal(signedCents('-1000000000.00'), null);
  assert.equal(signedCents('-999999999.99'), -MAX_OWNER_CENTS);
});

test('a figure reads as shillings, a loss with its minus in front, and an unknown one as a dash', () => {
  assert.equal(kesOrDash(125050), 'KES 1,250.50');
  assert.equal(kesOrDash(0), 'KES 0.00');
  assert.equal(kesOrDash(5), 'KES 0.05');
  assert.equal(kesOrDash(-30025), '-KES 300.25');
  assert.equal(kesOrDash(null), '—');
  assert.equal(kesOrDash(Number.NaN), '—');
  assert.equal(kesOrDash(Number.POSITIVE_INFINITY), '—');
});

test('an amount typed by a person is digits with at most two decimals, and a comma is refused', () => {
  assert.equal(typedCents('500'), 50000);
  assert.equal(typedCents('500.5'), 50050);
  assert.equal(typedCents('500.50'), 50050);
  assert.equal(typedCents(' 12 '), 1200);
  assert.equal(typedCents('0'), 0);
  assert.equal(typedCents('0.01'), 1);
  assert.equal(typedCents('0.1'), 10);
  assert.equal(typedCents('999999999.99'), MAX_OWNER_CENTS);
  const bad = ['', ' ', '1,250', '1.234', '-5', '+5', '5.', '.5', 'abc', '5 000', '1e3', '1234567890', '12.3.4'];
  for (const text of bad) assert.equal(typedCents(text), null, text);
});

test('cents go back to the number a money field takes, and a bad figure is never sent', () => {
  assert.equal(centsToAmount(125050), 1250.5);
  assert.equal(centsToAmount(7), 0.07);
  assert.equal(centsToAmount(115), 1.15);
  assert.equal(centsToAmount(0), 0);
  assert.equal(centsToAmount(MAX_OWNER_CENTS), 999_999_999.99);
  const bad = [-1, 1.5, Number.NaN, Infinity, MAX_OWNER_CENTS + 1, Number.MAX_SAFE_INTEGER + 2];
  for (const cents of bad) assert.equal(centsToAmount(cents), null, String(cents));
});

test('a figure that goes to the server and comes back is the same figure', () => {
  for (const cents of [1, 7, 99, 100, 101, 115, 12345, 99999, 100000, 7777777, MAX_OWNER_CENTS]) {
    assert.equal(signedCents(centsToAmount(cents)), cents, String(cents));
  }
});

test('a sum of money is put into an amount box so that it reads back as the same figure', () => {
  assert.equal(centsToTyped(125050), '1250.50');
  assert.equal(centsToTyped(7), '0.07');
  assert.equal(centsToTyped(100), '1.00');
  assert.equal(centsToTyped(0), '0.00');
  assert.equal(centsToTyped(MAX_OWNER_CENTS), '999999999.99');
  for (const cents of [0, 1, 7, 99, 100, 101, 115, 125050, 99_999, 1_000_000, MAX_OWNER_CENTS]) {
    assert.equal(typedCents(centsToTyped(cents)), cents, String(cents));
  }
  for (const bad of [-1, 1.5, NaN, Infinity, MAX_OWNER_CENTS + 1, Number.MAX_SAFE_INTEGER + 2]) assert.equal(centsToTyped(bad), '', String(bad));
});
