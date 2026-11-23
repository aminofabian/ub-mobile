import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StoreHit, StoreSnapshot } from '@kiosk/core';
import { cardFromHit, cardFromStore, monogramOf, readableTextOn } from '../src/lib/store-card';

const store = (overrides: Partial<StoreSnapshot> = {}): StoreSnapshot => ({
  businessId: 'aaaaaaaa-0000-4000-8000-000000000001',
  slug: 'acme',
  host: 'acme.kiosk.ke',
  displayName: 'Acme Mart',
  branding: {},
  fetchedAt: '2026-11-22T10:00:00Z',
  ...overrides,
});

test('the tile letter is the first letter of the name, in capitals, and never empty', () => {
  assert.equal(monogramOf('acme'), 'A');
  assert.equal(monogramOf('  fresh mart'), 'F');
  assert.equal(monogramOf('élan'), 'É');
  assert.equal(monogramOf('🛒 Corner shop'), '🛒', 'one whole character, not half of a pair');
  assert.equal(monogramOf('', 'zed'), 'Z');
  assert.equal(monogramOf('   ', '  '), '#');
});

test('a directory row becomes a card, with the platform address when the shop has none of its own', () => {
  const hit: StoreHit = { slug: 'acme', name: 'Acme Mart' };
  assert.deepEqual(cardFromHit(hit, 'kiosk.ke'), {
    key: 'acme',
    slug: 'acme',
    name: 'Acme Mart',
    monogram: 'A',
    logoUrl: null,
    address: 'acme.kiosk.ke',
    color: null,
  });
  assert.equal(cardFromHit(hit, '.kiosk.ke').address, 'acme.kiosk.ke');
  assert.equal(cardFromHit(hit, '').address, 'acme');
  assert.equal(cardFromHit({ ...hit, host: 'shop.acme.co.ke' }, 'kiosk.ke').address, 'shop.acme.co.ke');
});

test('a logo is used only when it is a secure web address', () => {
  const hit: StoreHit = { slug: 'acme', name: 'Acme', logoUrl: 'https://cdn.example/acme.png' };
  assert.equal(cardFromHit(hit, 'kiosk.ke').logoUrl, 'https://cdn.example/acme.png');
  assert.equal(cardFromHit({ ...hit, logoUrl: 'javascript:alert(1)' }, 'kiosk.ke').logoUrl, null);
  assert.equal(cardFromHit({ ...hit, logoUrl: 'http://cdn.example/acme.png' }, 'kiosk.ke').logoUrl, null);
  assert.equal(cardFromStore(store({ branding: { logoUrl: 'http://cdn.example/a.png' } }), 'kiosk.ke').logoUrl, null);
  assert.equal(cardFromStore(store({ branding: { logoUrl: 'file:///etc/passwd' } }), 'kiosk.ke').logoUrl, null);
  assert.equal(cardFromStore(store({ branding: { logoUrl: ' https://cdn.example/a.png ' } }), 'kiosk.ke').logoUrl, 'https://cdn.example/a.png');
  assert.equal(cardFromStore(store({ branding: { logoUrl: 42 } }), 'kiosk.ke').logoUrl, null);
});

test('a remembered shop becomes a card keyed by its id, in its own colour when the colour is valid', () => {
  const card = cardFromStore(store({ branding: { primaryColor: '#164715' } }), 'kiosk.ke');
  assert.equal(card.key, 'aaaaaaaa-0000-4000-8000-000000000001');
  assert.equal(card.name, 'Acme Mart');
  assert.equal(card.address, 'acme.kiosk.ke');
  assert.equal(card.color, '#164715');
  for (const bad of ['red', '#12', '#12345g', '164715', 7, null, undefined, 'url(x)']) {
    assert.equal(cardFromStore(store({ branding: { primaryColor: bad } }), 'kiosk.ke').color, null, String(bad));
  }
  assert.equal(cardFromStore(store({ branding: { primaryColor: '#abc' } }), 'kiosk.ke').color, '#abc');
});

test('a shop with no name or address still gets a card', () => {
  const card = cardFromStore(store({ displayName: '  ', host: '' }), 'kiosk.ke');
  assert.equal(card.name, 'acme');
  assert.equal(card.monogram, 'A');
  assert.equal(card.address, 'acme.kiosk.ke');
  assert.equal(cardFromStore(store({ host: '' }), '').address, 'acme');
});

test('letters on a shop-coloured tile are white on dark colours and dark on light ones', () => {
  assert.equal(readableTextOn('#164715'), '#ffffff', 'the platform green');
  assert.equal(readableTextOn('#000000'), '#ffffff');
  assert.equal(readableTextOn('#b42318'), '#ffffff', 'a strong red');
  assert.equal(readableTextOn('#fd800e'), '#141816', 'orange is too light for white letters');
  assert.equal(readableTextOn('#fbad00'), '#141816');
  assert.equal(readableTextOn('#ffffff'), '#141816');
  assert.equal(readableTextOn('#fff'), '#141816', 'short form');
  assert.equal(readableTextOn('#777777'), '#141816', 'mid grey: white would only reach 4.4 to 1');
  assert.equal(readableTextOn('#757575'), '#ffffff', 'the darkest grey that white clears 4.5 to 1');
});

test('a colour that is not a colour gets the default letters', () => {
  assert.equal(readableTextOn('red'), '#ffffff');
  assert.equal(readableTextOn(''), '#ffffff');
  assert.equal(readableTextOn('#12345'), '#ffffff');
  assert.equal(readableTextOn('red', 'LIGHT', 'DARK'), 'LIGHT');
});
