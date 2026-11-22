// node --test packages/config/metro/tenant-assets.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { overrideFor, withTenantAssets } = require('./tenant-assets');

const SHOP_MARK = '/repo/tenants/fresh/assets/brand-mark.png';

/** The default resolver Metro hands to a configured resolveRequest, as a recorder. */
function recorder() {
  const seen = [];
  const context = {
    resolveRequest: (_context, name, platform) => {
      seen.push({ name, platform });
      return { type: 'sourceFile', filePath: name };
    },
  };
  return { seen, context };
}

const shopHasMark = (filename) => (filename === 'brand-mark.png' ? SHOP_MARK : null);
const noShop = () => null;

test('overrideFor: swaps only the listed art, and only inside an assets folder', () => {
  assert.equal(overrideFor('../../assets/brand-mark.png', shopHasMark), SHOP_MARK);
  assert.equal(overrideFor('./assets/brand-mark.png', shopHasMark), SHOP_MARK);
  assert.equal(overrideFor('..\\..\\assets\\brand-mark.png', shopHasMark), SHOP_MARK, 'Windows separators');
  assert.equal(overrideFor('../../assets/icon.png', shopHasMark), null, 'other art is native, not swapped here');
  assert.equal(overrideFor('some-package/brand-mark.png', shopHasMark), null, 'not under assets/');
  assert.equal(overrideFor('../../assets/brand-mark.png.map', shopHasMark), null);
  assert.equal(overrideFor('../../assets/old-brand-mark.png', shopHasMark), null, 'whole file name must match');
  assert.equal(overrideFor(undefined, shopHasMark), null);
});

test('overrideFor: a shop with no copy keeps the app file', () => {
  assert.equal(overrideFor('../../assets/brand-mark.png', noShop), null);
});

test('the generic build resolves exactly what the app asked for', () => {
  const { seen, context } = recorder();
  const config = withTenantAssets({ resolver: {} }, { resolveAsset: noShop });
  config.resolver.resolveRequest(context, '../../assets/brand-mark.png', 'ios');
  assert.deepEqual(seen, [{ name: '../../assets/brand-mark.png', platform: 'ios' }]);
});

test("a shop's build bundles that shop's mark, through Metro's own resolver", () => {
  const { seen, context } = recorder();
  const config = withTenantAssets({ resolver: {} }, { resolveAsset: shopHasMark });
  config.resolver.resolveRequest(context, '../../assets/brand-mark.png', 'android');
  assert.deepEqual(seen, [{ name: SHOP_MARK, platform: 'android' }]);
});

test('requests for anything else pass through untouched, even in a shop build', () => {
  const { seen, context } = recorder();
  const config = withTenantAssets({ resolver: {} }, { resolveAsset: shopHasMark });
  config.resolver.resolveRequest(context, 'react-native', 'ios');
  config.resolver.resolveRequest(context, '../../assets/icon.png', 'ios');
  assert.deepEqual(
    seen.map((entry) => entry.name),
    ['react-native', '../../assets/icon.png']
  );
});

test('a resolver that was already configured still runs, on the swapped path', () => {
  const { seen, context } = recorder();
  const calls = [];
  const earlier = (ctx, name, platform) => {
    calls.push(name);
    return ctx.resolveRequest(ctx, name, platform);
  };
  const config = withTenantAssets({ resolver: { resolveRequest: earlier } }, { resolveAsset: shopHasMark });
  config.resolver.resolveRequest(context, '../../assets/brand-mark.png', 'ios');
  assert.deepEqual(calls, [SHOP_MARK]);
  assert.deepEqual(seen, [{ name: SHOP_MARK, platform: 'ios' }]);
});
