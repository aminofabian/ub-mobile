import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAddress,
  applyContact,
  blankValues,
  checkCheckoutValues,
  DRAFT_MAX_AGE_MS,
  MAX_CONTACT_NAME_PART,
  parseDraft,
  planOrder,
  rememberByDefault,
  resolvePaymentChoice,
  serializeDraft,
  splitName,
  type CheckoutValues,
  type ShopFacts,
} from '../src/lib/checkout-form';

const SHOP: ShopFacts = { areaNames: ['Kilimani', 'Lavington'], hasOnlinePay: true };
const NOW = new Date('2026-11-23T09:00:00.000Z');

function delivery(extra: Partial<CheckoutValues> = {}): CheckoutValues {
  return {
    ...blankValues('delivery', false),
    name: 'Amina Wanjiru',
    phone: '0712 345 678',
    email: 'amina@example.co.ke',
    area: 'kilimani',
    street: 'Sunrise Apartments, Block B',
    deliveryNotes: 'Gate 4411',
    ...extra,
  };
}

function pickup(extra: Partial<CheckoutValues> = {}): CheckoutValues {
  return { ...blankValues('pickup', false), name: 'Amina Wanjiru', phone: '0712345678', ...extra };
}

test('a complete delivery order has nothing wrong with it', () => {
  assert.deepEqual(checkCheckoutValues(delivery(), SHOP), {});
});

test('a complete pickup order needs a name and a phone, and nothing about where', () => {
  assert.deepEqual(checkCheckoutValues(pickup(), SHOP), {});
  assert.deepEqual(checkCheckoutValues(pickup(), { areaNames: [], hasOnlinePay: false }), {});
  assert.deepEqual(checkCheckoutValues(pickup(), { areaNames: null, hasOnlinePay: null }), {});
});

test('each thing that is missing is named, in plain words, beside what is missing', () => {
  const errors = checkCheckoutValues({ ...delivery(), name: '', phone: '', area: '', street: '  ' }, SHOP);
  assert.deepEqual(Object.keys(errors).sort(), ['area', 'name', 'phone', 'street']);
  assert.equal(errors.name, 'Add your name so the shop knows who to call.');
  assert.equal(errors.phone, 'We need a phone number to reach you.');
  assert.equal(errors.area, 'Choose the area you are in.');
  assert.equal(errors.street, 'Add the building, estate or landmark so the rider can find you.');
});

test('a name, a phone and an email are checked by the rules the server and the website use', () => {
  assert.equal(checkCheckoutValues(delivery({ name: 'A' }), SHOP).name, 'That name looks too short.');
  assert.equal(checkCheckoutValues(delivery({ name: 'x'.repeat(256) }), SHOP).name, 'That name is too long.');
  assert.equal(checkCheckoutValues(delivery({ phone: '12345' }), SHOP).phone, 'Enter a Kenyan mobile, e.g. 0712 345 678.');
  assert.deepEqual(checkCheckoutValues(delivery({ phone: '+254 0712 345 678' }), SHOP), {});
  assert.equal(checkCheckoutValues(delivery({ email: 'amina@' }), SHOP).email, 'That email does not look right. Fix it, or leave it empty.');
  assert.equal(checkCheckoutValues(delivery({ email: 'a b@c.co' }), SHOP).email !== undefined, true);
  assert.deepEqual(checkCheckoutValues(delivery({ email: '' }), SHOP), {}, 'an email is optional');
  assert.deepEqual(checkCheckoutValues(delivery({ email: '   ' }), SHOP), {});
});

test('a name the server\'s contact step would refuse is refused here, a part at a time', () => {
  const name = (value: string, make = delivery) => checkCheckoutValues(make({ name: value }), SHOP).name;
  assert.equal(name('A'.repeat(120)), undefined, 'a first name of 120 is taken');
  assert.equal(name('A'.repeat(121)), 'That name is too long.');
  assert.equal(name('A'.repeat(120) + ' ' + 'B'.repeat(120)), undefined, '120 and 120 are taken, though together they pass 240');
  assert.equal(name('Amina ' + 'B'.repeat(121)), 'That name is too long.', 'the rest of the name is a part');
  assert.equal(name('Amina ' + 'B '.repeat(60) + 'C'.repeat(10)), 'That name is too long.', 'the rest is all the words after the first, with their spaces');
  assert.equal(name('Amina ' + 'B '.repeat(59) + 'C'), undefined, 'and fits when it is 120');
  assert.equal(name('  Amina   Wanjiru  '), undefined, 'spaces around and between are not counted');
  assert.equal(name('A'.repeat(121) + ' B', pickup), 'That name is too long.', 'the same for a pickup, which goes in the same fields');
  assert.equal(MAX_CONTACT_NAME_PART, 120);
  assert.equal(name('x'.repeat(256)), 'That name is too long.', 'and a name past the order\'s own limit is too long as well');
});

test('an area must be one the shop delivers to, ignoring case, and the reason is given when it cannot be', () => {
  assert.equal(checkCheckoutValues(delivery({ area: 'Karen' }), SHOP).area, 'The shop does not deliver to that area. Choose one from the list.');
  assert.deepEqual(checkCheckoutValues(delivery({ area: 'LAVINGTON' }), SHOP), {});
  assert.equal(
    checkCheckoutValues(delivery(), { areaNames: [], hasOnlinePay: true }).area,
    'This shop does not deliver yet. Choose pickup.',
  );
  assert.equal(
    checkCheckoutValues(delivery(), { areaNames: null, hasOnlinePay: true }).area,
    'The shop\'s delivery areas have not loaded. Check your connection, or choose pickup.',
  );
});

test('the limits the server has are kept here, so the order is not refused for them', () => {
  assert.equal(checkCheckoutValues(delivery({ street: 'x'.repeat(501) }), SHOP).street, 'Shorten this to 500 characters.');
  assert.equal(checkCheckoutValues(delivery({ deliveryNotes: 'x'.repeat(1001) }), SHOP).deliveryNotes, 'Shorten the notes to 1,000 characters.');
  assert.equal(checkCheckoutValues(delivery({ whatsApp: '7'.repeat(65) }), SHOP).whatsApp, 'That WhatsApp number is too long.');
  assert.deepEqual(checkCheckoutValues(delivery({ street: 'x'.repeat(500), deliveryNotes: 'y'.repeat(1000) }), SHOP), {});
});

test('the whole line of notes is within 2000 characters or the order is not sent', () => {
  const long = delivery({ street: 'x'.repeat(500), deliveryNotes: 'y'.repeat(1000), whatsApp: 'z'.repeat(64), county: 'c'.repeat(120), area: 'Kilimani' });
  assert.deepEqual(checkCheckoutValues(long, SHOP), {});
  const tooLong = delivery({ street: 'x'.repeat(500), deliveryNotes: 'y'.repeat(1000), whatsApp: 'z'.repeat(64), county: 'c'.repeat(1000), area: 'Kilimani' });
  assert.equal(
    checkCheckoutValues(tooLong, SHOP).form,
    'The details are too long for the shop to take. Shorten the address or the notes.',
  );
});

test('the way to pay is the website\'s: M-Pesa while the shop takes it, unless chosen otherwise', () => {
  assert.equal(resolvePaymentChoice({ hasOnlinePay: true, touched: false, choice: 'pay-later' }), 'mpesa', 'an untouched choice is the default');
  assert.equal(resolvePaymentChoice({ hasOnlinePay: true, touched: true, choice: 'pay-later' }), 'pay-later');
  assert.equal(resolvePaymentChoice({ hasOnlinePay: true, touched: true, choice: 'mpesa' }), 'mpesa');
  assert.equal(resolvePaymentChoice({ hasOnlinePay: false, touched: true, choice: 'mpesa' }), 'pay-later', 'no online payment, nothing to pay with now');
  assert.equal(resolvePaymentChoice({ hasOnlinePay: false, touched: false, choice: 'mpesa' }), 'pay-later');
  assert.equal(resolvePaymentChoice({ hasOnlinePay: null, touched: false, choice: 'mpesa' }), 'mpesa', 'not known: the choice stands');
  assert.equal(resolvePaymentChoice({ hasOnlinePay: null, touched: true, choice: 'pay-later' }), 'pay-later');
});

test('a delivery order is sent as the website sends it', () => {
  const result = planOrder(delivery({ payment: 'pay-later', paymentTouched: true, whatsApp: '0722 111 222', remember: true }), SHOP);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(result.plan.request, {
    customerName: 'Amina Wanjiru',
    customerPhone: '+254 712345678',
    customerEmail: 'amina@example.co.ke',
    notes: 'Payment: Pay on delivery | Street: Sunrise Apartments, Block B | County: Nairobi | Subcounty: Kilimani | Ward: Kilimani | WhatsApp: 0722 111 222 | Set as default address | Notes: Gate 4411',
  });
  assert.equal(result.plan.payment, 'pay-later');
  assert.equal(result.plan.fulfilment, 'delivery');
});

test('the area goes to the shop as the shop spells it, not as it was typed', () => {
  const result = planOrder(delivery({ area: '  LAVINGTON ' }), SHOP);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.match(result.plan.request.notes ?? '', /Subcounty: Lavington \| Ward: Lavington/);
  assert.equal(result.plan.deliveryStep?.ward, 'Lavington');
  assert.equal(result.plan.deliveryStep?.subCounty, 'Lavington');
});

test('a pickup says so, and has no address and no server steps', () => {
  const result = planOrder(pickup({ payment: 'pay-later', paymentTouched: true, deliveryNotes: 'After 5pm' }), { areaNames: [], hasOnlinePay: true });
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.plan.request.notes, 'Pickup at the counter | Payment: Pay at pickup | Notes: After 5pm');
  assert.equal(result.plan.request.customerEmail, undefined);
  assert.equal(result.plan.contactStep, null);
  assert.equal(result.plan.deliveryStep, null);
  assert.equal(result.plan.remember, null);
});

test('a pickup\'s notes say it is a pickup, whatever else there is to say', () => {
  const result = planOrder(pickup({ payment: 'mpesa' }), { areaNames: null, hasOnlinePay: true });
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.plan.request.notes, 'Pickup at the counter');
});

test('the server\'s two steps are made for a delivery with an email and a last name, in the shape the server wants', () => {
  const result = planOrder(delivery({ remember: true, whatsApp: '0722 111 222' }), SHOP);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(result.plan.contactStep, {
    firstName: 'Amina',
    lastName: 'Wanjiru',
    email: 'amina@example.co.ke',
    areaCode: '+254',
    phone: '712345678',
    whatsApp: '0722 111 222',
  });
  assert.deepEqual(result.plan.deliveryStep, {
    county: 'Nairobi',
    subCounty: 'Kilimani',
    ward: 'Kilimani',
    streetAddress: 'Sunrise Apartments, Block B',
    deliveryNotes: 'Gate 4411',
    saveForNextTime: true,
  });
});

test('without an email, or with a one-word name, the order is placed and the server\'s steps are left out', () => {
  const noEmail = planOrder(delivery({ email: '' }), SHOP);
  assert.ok(noEmail.ok);
  if (noEmail.ok) {
    assert.equal(noEmail.plan.contactStep, null);
    assert.equal(noEmail.plan.deliveryStep, null, 'the delivery step needs the contact step before it');
    assert.equal(noEmail.plan.request.customerEmail, undefined);
  }
  const oneName = planOrder(delivery({ name: 'Amina' }), SHOP);
  assert.ok(oneName.ok);
  if (oneName.ok) {
    assert.equal(oneName.plan.contactStep, null);
    assert.equal(oneName.plan.request.customerName, 'Amina');
  }
});

test('a name with extra spaces is one name, and the last name is everything after the first', () => {
  assert.deepEqual(splitName('  Amina   Wanjiru  Kamau '), { firstName: 'Amina', lastName: 'Wanjiru Kamau' });
  assert.deepEqual(splitName('Amina'), { firstName: 'Amina', lastName: '' });
  assert.deepEqual(splitName('   '), { firstName: '', lastName: '' });
  const result = planOrder(delivery({ name: '  Amina    Wanjiru ' }), SHOP);
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.plan.request.customerName, 'Amina Wanjiru');
});

test('an order that is not right is not planned, and says what is wrong', () => {
  const result = planOrder(delivery({ street: '' }), SHOP);
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(Object.keys(result.errors), ['street']);
});

test('what is kept for next time is kept only when the shopper agreed, and a pickup keeps no address', () => {
  const no = planOrder(delivery({ remember: false }), SHOP);
  assert.ok(no.ok);
  if (no.ok) assert.equal(no.plan.remember, null);
  const yes = planOrder(delivery({ remember: true }), SHOP);
  assert.ok(yes.ok);
  if (yes.ok) {
    assert.deepEqual(yes.plan.remember?.contact, { name: 'Amina Wanjiru', phone: '0712 345 678', email: 'amina@example.co.ke', whatsApp: '' });
    assert.deepEqual(yes.plan.remember?.address, {
      area: 'Kilimani',
      street: 'Sunrise Apartments, Block B',
      county: 'Nairobi',
      deliveryNotes: 'Gate 4411',
      whatsApp: '',
    });
  }
  const pick = planOrder(pickup({ remember: true }), SHOP);
  assert.ok(pick.ok);
  if (pick.ok) {
    assert.equal(pick.plan.remember?.address, null);
    assert.equal(pick.plan.remember?.contact.name, 'Amina Wanjiru');
  }
});

test('a signed-in shopper is remembered unless they say no, and a guest is asked, as on the website', () => {
  assert.equal(rememberByDefault(true), true);
  assert.equal(rememberByDefault(false), false);
});

test('a saved address and a saved contact start the form, and fill only what is empty', () => {
  const base = blankValues('pickup', false);
  const withAddress = applyAddress(base, { id: 'a1', area: 'Kilimani', street: 'Block B', county: '', deliveryNotes: 'Gate', whatsApp: '0722', isDefault: true, lastUsedAt: '' });
  assert.equal(withAddress.fulfilment, 'delivery');
  assert.equal(withAddress.area, 'Kilimani');
  assert.equal(withAddress.county, 'Nairobi');
  assert.equal(withAddress.whatsApp, '0722');
  const typed = applyContact({ ...base, name: 'Typed', phone: '' }, { name: 'Saved', phone: '0712345678', email: 'a@b.co', whatsApp: '' });
  assert.equal(typed.name, 'Typed', 'what is typed is not overwritten');
  assert.equal(typed.phone, '0712345678');
  assert.equal(typed.email, 'a@b.co');
  assert.equal(applyContact(base, null), base);
});

test('a half-filled form is kept for a day, and what is damaged or too old is not a form', () => {
  const values = delivery({ remember: true, payment: 'pay-later', paymentTouched: true });
  const raw = serializeDraft(values, NOW);
  assert.deepEqual(parseDraft(raw, NOW), values);
  assert.deepEqual(parseDraft(raw, new Date(NOW.getTime() + DRAFT_MAX_AGE_MS)), values);
  assert.equal(parseDraft(raw, new Date(NOW.getTime() + DRAFT_MAX_AGE_MS + 1)), null);
  assert.equal(parseDraft(raw, new Date(NOW.getTime() - 120_000)), null, 'saved in the future');
  assert.equal(parseDraft(null, NOW), null);
  assert.equal(parseDraft('x', NOW), null);
  assert.equal(parseDraft('{"values":{},"savedAt":"never"}', NOW), null);
});

test('a draft with odd values is made safe, not trusted', () => {
  const raw = JSON.stringify({
    savedAt: NOW.toISOString(),
    values: { fulfilment: 'drone', name: 5, phone: 'x'.repeat(500), payment: 'cash', remember: 'yes', street: 'S' },
  });
  const read = parseDraft(raw, NOW);
  assert.ok(read);
  assert.equal(read?.fulfilment, 'delivery');
  assert.equal(read?.name, '');
  assert.equal(read?.phone.length, 64);
  assert.equal(read?.payment, 'mpesa');
  assert.equal(read?.remember, false);
  assert.equal(read?.street, 'S');
});

test('a pickup does not ask the shop to keep an address as the default, and a delivery does', () => {
  const pick = planOrder(pickup({ remember: true }), SHOP);
  assert.ok(pick.ok);
  if (pick.ok) assert.ok(!(pick.plan.request.notes ?? '').includes('Set as default address'));
  const home = planOrder(delivery({ remember: true }), SHOP);
  assert.ok(home.ok);
  if (home.ok) assert.ok((home.plan.request.notes ?? '').includes('Set as default address'));
});

test('a pickup makes no server steps, even with an email and a full name', () => {
  const result = planOrder(pickup({ email: 'amina@example.co.ke', remember: true }), SHOP);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.plan.contactStep, null);
  assert.equal(result.plan.deliveryStep, null);
});

test('the shop is asked to keep the delivery details only when the shopper agreed', () => {
  const no = planOrder(delivery({ remember: false }), SHOP);
  assert.ok(no.ok);
  if (no.ok) assert.equal(no.plan.deliveryStep?.saveForNextTime, false);
});

test('a typed WhatsApp number is not replaced by a saved address, and is kept with what is remembered', () => {
  const saved = { id: 'a1', area: 'Kilimani', street: 'Block B', county: '', deliveryNotes: '', whatsApp: '0722', isDefault: true, lastUsedAt: '' };
  assert.equal(applyAddress({ ...blankValues('pickup', false), whatsApp: '0711 000 111' }, saved).whatsApp, '0711 000 111');
  const result = planOrder(delivery({ remember: true, whatsApp: ' 0722 111 222 ' }), SHOP);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.plan.remember?.contact.whatsApp, '0722 111 222');
  assert.equal(result.plan.remember?.address?.whatsApp, '0722 111 222');
});

test('a draft with no county gets the usual one', () => {
  const raw = JSON.stringify({ savedAt: NOW.toISOString(), values: { fulfilment: 'delivery', name: 'Amina Wanjiru', phone: '0712345678', county: '' } });
  assert.equal(parseDraft(raw, NOW)?.county, 'Nairobi');
});
