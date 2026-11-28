import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinCheckoutPhone, toMsisdn254, typedPhoneFrom } from '../src/lib/checkout-phone';
import { looksLikeKenyanMobile, toKenyanLocal07 } from '../src/lib/phone';

test('a Kenyan mobile is written the way the website writes it, whatever way it was typed', () => {
  for (const typed of ['0712345678', '0712 345 678', '712345678', '+254712345678', '254712345678', '+254 712 345 678']) {
    assert.equal(joinCheckoutPhone('+254', typed), '+254 712345678', typed);
  }
});

test('the 0 left in after the dial code is not kept, as on the website', () => {
  assert.equal(joinCheckoutPhone('+254', '+254 0712345678'), '+254 712345678');
  assert.equal(toKenyanLocal07('+254 0712345678'), '0712345678');
  assert.equal(looksLikeKenyanMobile('+254 0712 345 678'), true);
  assert.equal(toMsisdn254('2540712345678'), '254712345678');
});

test('the newer Safaricom and Airtel ranges are Kenyan mobiles too', () => {
  assert.equal(joinCheckoutPhone('+254', '0110123456'), '+254 110123456');
  assert.equal(joinCheckoutPhone('+254', '0100123456'), '+254 100123456');
  assert.equal(toMsisdn254('0112345678'), '254112345678');
});

test('what is not a Kenyan mobile is passed on as typed, for the shop to read', () => {
  assert.equal(joinCheckoutPhone('+254', '12345'), '+254 12345');
  assert.equal(joinCheckoutPhone('+256', '0772 123456'), '+256 0772 123456');
  assert.equal(joinCheckoutPhone('', ''), '+254');
  assert.equal(joinCheckoutPhone('  ', '  '), '+254');
  assert.equal(joinCheckoutPhone('+255', ''), '+255');
  assert.equal(toMsisdn254('hello'), null);
  assert.equal(toMsisdn254(''), null);
});

test('the number a person would type is got back from the one the order carries', () => {
  assert.equal(typedPhoneFrom('+254 712345678'), '0712345678');
  assert.equal(typedPhoneFrom('0712 345 678'), '0712345678');
  assert.equal(typedPhoneFrom(' +256 772 123 456 '), '+256 772 123 456');
});
