import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailLink, tillRequestMessage, whatsappLink } from '../src/lib/till-request';

test('tillRequestMessage names the shop and what has to happen', () => {
  const message = tillRequestMessage({
    shopName: 'Palmart',
    branchName: 'Westlands',
    reason: 'This phone is not approved as a till yet.',
  });
  assert.match(message, /Palmart · Westlands/);
  assert.match(message, /not registered as a till/);
  assert.match(message, /pairing code|Business → Tills/);
});

test('whatsapp and email links carry the message', () => {
  const ask = {
    shopName: 'Palmart',
    branchName: null,
    reason: 'Please approve this phone.',
    ownerPhone: '+254712345678',
  };
  assert.match(whatsappLink(ask), /^https:\/\/wa\.me\/254712345678\?text=/);
  assert.match(emailLink(ask), /^mailto:\?subject=/);
  assert.match(emailLink(ask), /body=/);
});
