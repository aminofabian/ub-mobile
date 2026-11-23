import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supportLinks } from '../src/lib/support-links';

test('no contact from the server means no links, not invented ones', () => {
  assert.deepEqual(supportLinks(null), []);
  assert.deepEqual(supportLinks(undefined), []);
  assert.deepEqual(supportLinks({}), []);
});

test('each way to reach support becomes a link the phone can open, in a fixed order', () => {
  const links = supportLinks({
    url: 'https://kiosk.ke/help',
    email: 'help@kiosk.ke',
    whatsapp: '+254 700 111 222',
    phone: '+254 (700) 000-000',
  });
  assert.deepEqual(links, [
    { kind: 'phone', label: 'Call', url: 'tel:+254700000000' },
    { kind: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/254700111222' },
    { kind: 'email', label: 'Email', url: 'mailto:help@kiosk.ke' },
    { kind: 'web', label: 'Help centre', url: 'https://kiosk.ke/help' },
  ]);
});

test('a local number keeps its leading zero and gets no plus', () => {
  assert.deepEqual(supportLinks({ phone: '0700 000 000' }), [{ kind: 'phone', label: 'Call', url: 'tel:0700000000' }]);
});

test('numbers that are too short, and addresses that are not web addresses, are left out', () => {
  assert.deepEqual(supportLinks({ phone: '123', whatsapp: '+25', url: 'javascript:alert(1)' }), []);
  assert.deepEqual(supportLinks({ url: 'ftp://files.example/help' }), []);
});
