import assert from 'node:assert/strict';
import test from 'node:test';
import { callUrl, dialable, phoneSearchDigits, whatsappNumber, whatsappUrl } from '../src/lib/phone';

test('a phone number is kept as digits and a leading plus, with the spacing taken out', () => {
  assert.equal(dialable('0712 345 678'), '0712345678');
  assert.equal(dialable('+254 (712) 345-678'), '+254712345678');
  assert.equal(dialable('  0712.345.678 '), '0712345678');
  assert.equal(dialable('123456'), '123456');
  assert.equal(dialable('+123456789012345'), '+123456789012345');
});

test('digits are never pulled out of words', () => {
  const bad: unknown[] = ['0712345678 ext 12', 'call me', '', '  ', '12345', '+1234567890123456', '07123+45678', '++254712345678', null, undefined, 712_345_678, {}];
  for (const value of bad) assert.equal(dialable(value), null, String(value));
});

test('a number that can be dialled has a tel link and any other has none', () => {
  assert.equal(callUrl('0712 345 678'), 'tel:+254712345678', 'a number written locally is dialled with its country code');
  assert.equal(callUrl('+254712345678'), 'tel:+254712345678');
  assert.equal(callUrl('not a number'), null);
  assert.equal(callUrl(null), null);
});

test('a Kenyan number written any of the usual ways becomes the international one', () => {
  assert.equal(whatsappNumber('0712345678'), '254712345678');
  assert.equal(whatsappNumber('0112345678'), '254112345678');
  assert.equal(whatsappNumber('712345678'), '254712345678');
  assert.equal(whatsappNumber('112345678'), '254112345678');
  assert.equal(whatsappNumber('254712345678'), '254712345678');
  assert.equal(whatsappNumber('+254712345678'), '254712345678');
  assert.equal(whatsappNumber('00254712345678'), '254712345678');
  assert.equal(whatsappNumber('0712 345 678'), '254712345678');
});

test('a number from another country needs its country written, and a doubtful one has no link', () => {
  assert.equal(whatsappNumber('+14155550123'), '14155550123');
  assert.equal(whatsappNumber('0014155550123'), '14155550123');
  const unclear = ['0212345678', '0812345678', '071234567', '07123456789', '2547123456', '254212345678', '+0712345678', '000712345678', '+1234567', '123456', 'abc', null];
  for (const value of unclear) assert.equal(whatsappNumber(value), null, String(value));
});

test('a chat link carries the number and the message, spelled for a web address', () => {
  assert.equal(whatsappUrl('0712345678', 'Hello Wanjiku & Co: 500?'), 'https://wa.me/254712345678?text=Hello%20Wanjiku%20%26%20Co%3A%20500%3F');
  assert.equal(whatsappUrl('0712345678', '   '), 'https://wa.me/254712345678');
  assert.equal(whatsappUrl('0712345678', ''), 'https://wa.me/254712345678');
  assert.equal(whatsappUrl('nope', 'Hello'), null);
});

test('a message is cleaned of control characters and cut to a sane length', () => {
  assert.equal(whatsappUrl('0712345678', 'a\u0000b\nc\td'), `https://wa.me/254712345678?text=${encodeURIComponent('a b\nc d')}`);
  const long = whatsappUrl('0712345678', 'x'.repeat(5000)) ?? '';
  assert.equal(decodeURIComponent(long.split('text=')[1] ?? '').length, 700);
});

test('a number is dialled with its country code however it was written, because the server keeps digits only', () => {
  assert.equal(callUrl('254712345678'), 'tel:+254712345678');
  assert.equal(callUrl('0712345678'), 'tel:+254712345678');
  assert.equal(callUrl('0112345678'), 'tel:+254112345678');
  assert.equal(callUrl('+254 712 345 678'), 'tel:+254712345678');
  assert.equal(callUrl('712345678'), 'tel:+254712345678');
  assert.equal(callUrl('+14155552671'), 'tel:+14155552671');
});

test('a number that is not clearly Kenyan is dialled as written, and one that cannot be dialled is null', () => {
  assert.equal(callUrl('0201234567'), 'tel:0201234567');
  assert.equal(callUrl('123456'), 'tel:123456');
  assert.equal(callUrl('call me'), null);
  assert.equal(callUrl(null), null);
  assert.equal(callUrl(''), null);
});

test('a number typed into the search is asked for by the digits every way of writing it shares', () => {
  assert.equal(phoneSearchDigits('0712 345'), '712345');
  assert.equal(phoneSearchDigits('0712345678'), '712345678');
  assert.equal(phoneSearchDigits('+254 712 345'), '712345');
  assert.equal(phoneSearchDigits('254712345678'), '712345678');
  assert.equal(phoneSearchDigits('00254712345678'), '712345678');
  assert.equal(phoneSearchDigits('(0712) 345-678'), '712345678');
  assert.equal(phoneSearchDigits('712345678'), '712345678');
  assert.equal(phoneSearchDigits('+14155552671'), '14155552671');
});

test('a search that is not a number, or has too few digits to narrow anything, is left as it was typed', () => {
  assert.equal(phoneSearchDigits('Wanjiku'), null);
  assert.equal(phoneSearchDigits('Shop 24'), null);
  assert.equal(phoneSearchDigits('07'), null);
  assert.equal(phoneSearchDigits(''), null);
  assert.equal(phoneSearchDigits('071'), '071');
  assert.equal(phoneSearchDigits('254'), '254');
  assert.equal(phoneSearchDigits('+2547'), '2547');
  assert.equal(phoneSearchDigits('0012'), '0012');
});
