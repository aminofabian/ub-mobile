// The Shopper's brand helpers. They import nothing, so node runs the TypeScript directly.
//   node --test apps/shopper/test/*.test.mjs
// Needs Node 22.18+, where type stripping is on by default (22.6 to 22.17: add --experimental-strip-types).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_NAME, brandName } from '../src/lib/brand.ts';
import { resolveBrandColors } from '../src/theme/brand-colors.ts';

const TOKENS = { primary: '#164715', accent: '#fd800e' };
const PLATFORM_GREEN = '#28A745';

test('brandName: the shop when there is one, the platform when there is not', () => {
  assert.equal(PLATFORM_NAME, 'Kiosk');
  assert.equal(brandName('Fresh Mart'), 'Fresh Mart');
  assert.equal(brandName('  Fresh Mart  '), 'Fresh Mart');
  assert.equal(brandName(null), 'Kiosk');
  assert.equal(brandName(undefined), 'Kiosk');
  assert.equal(brandName(''), 'Kiosk');
  assert.equal(brandName('   '), 'Kiosk');
  assert.equal(brandName(42), 'Kiosk');
});

test('a white-label build wears its baked colours, not the CMS record', () => {
  const colors = resolveBrandColors({
    whiteLabel: true,
    baked: { primary: '#0b5394', accent: '#e69138' },
    cms: { primaryColor: PLATFORM_GREEN, accentColor: PLATFORM_GREEN },
    fallback: TOKENS,
  });
  assert.deepEqual(colors, { primary: '#0b5394', accent: '#e69138' });
});

test('a white-label build baked with the app tokens looks exactly as it always did', () => {
  // Same inputs the existing shop build carries: baked tokens, and a CMS record still on the platform green.
  const colors = resolveBrandColors({
    whiteLabel: true,
    baked: { primary: '#164715', accent: '#fd800e' },
    cms: { primaryColor: PLATFORM_GREEN, accentColor: PLATFORM_GREEN },
    fallback: TOKENS,
  });
  assert.deepEqual(colors, TOKENS);
});

test('a white-label build with nothing baked falls back to the tokens, never to the CMS', () => {
  assert.deepEqual(
    resolveBrandColors({
      whiteLabel: true,
      baked: null,
      cms: { primaryColor: '#123456', accentColor: '#654321' },
      fallback: TOKENS,
    }),
    TOKENS
  );
  assert.deepEqual(
    resolveBrandColors({ whiteLabel: true, baked: { primary: 'green', accent: '#abc' }, fallback: TOKENS }),
    TOKENS
  );
});

test('the generic build wears the chosen shop\'s CMS colours', () => {
  const colors = resolveBrandColors({
    whiteLabel: false,
    baked: { primary: '#000000', accent: '#000000' },
    cms: { primaryColor: ' #0b5394 ', accentColor: '#e69138' },
    fallback: TOKENS,
  });
  assert.deepEqual(colors, { primary: '#0b5394', accent: '#e69138' });
});

test('the generic build falls back to the tokens when the CMS has nothing usable', () => {
  assert.deepEqual(resolveBrandColors({ whiteLabel: false, fallback: TOKENS }), TOKENS);
  assert.deepEqual(resolveBrandColors({ whiteLabel: false, cms: null, fallback: TOKENS }), TOKENS);
  assert.deepEqual(
    resolveBrandColors({
      whiteLabel: false,
      cms: { primaryColor: 'green', accentColor: '#12345' },
      fallback: TOKENS,
    }),
    TOKENS
  );
  assert.deepEqual(
    resolveBrandColors({ whiteLabel: false, cms: { primaryColor: '#0b5394' }, fallback: TOKENS }),
    { primary: '#0b5394', accent: '#fd800e' },
    'each colour falls back on its own'
  );
});
