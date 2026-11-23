import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKenyanPhone } from '../src/lib/phone';

test('the ways people write a mobile number all come out as 254 and nine digits', () => {
  for (const typed of [
    '0712345678',
    '0712 345 678',
    '+254712345678',
    '+254 712 345 678',
    '254712345678',
    '712345678',
    '0712-345-678',
    '(0712) 345678',
    '+254 0712 345 678',
    '  0712345678  ',
  ]) {
    assert.equal(normalizeKenyanPhone(typed), '254712345678', JSON.stringify(typed));
  }
});

test('the 01 mobile numbers are mobiles too', () => {
  assert.equal(normalizeKenyanPhone('0112345678'), '254112345678');
  assert.equal(normalizeKenyanPhone('+254112345678'), '254112345678');
});

test('what is not a mobile number is refused', () => {
  for (const typed of [
    '',
    '   ',
    'abc',
    '071234567',
    '07123456789',
    '0212345678',
    '254212345678',
    '+1 415 555 0100',
    '0312345678',
    '2547123456789',
  ]) {
    assert.equal(normalizeKenyanPhone(typed), null, JSON.stringify(typed));
  }
});
