'use strict';
/**
 * The only places the source of the apps and packages (`src` folders) may say "palmart", in any case.
 * scripts/check-generic-config.js fails on any other match, and on an entry here that matches
 * nothing, so this list can only shrink or be argued for in review. Plan §5.9.
 *
 * `match` is tested against one line of the file.
 */
module.exports = [
  {
    file: 'packages/core/src/storage-keys.ts',
    match: /palmart\.(shopper|customer)\./,
    reason:
      'The old Shopper storage names. They are only the inputs of the one-time migration that carries a Palmart upgrade\'s profile, remembered numbers and device secret into the per-store layout, so nothing reads or writes them any more.',
  },
  {
    file: 'apps/shopper/src/components/MartHero.tsx',
    match: /\^Palmart/,
    reason: 'Strips the "Palmart | " prefix that Palmart\'s stored page title carries.',
  },
  {
    file: 'apps/shopper/src/theme/mart.ts',
    match: /Palmart's world/,
    reason:
      'Comment naming the design language. The tokens are the Shopper\'s fallback palette; no code asks whether the build is Palmart.',
  },
  {
    file: 'packages/core/src/deep-link.ts',
    match: /palmart/i,
    reason: 'Example in a doc comment.',
  },
  {
    file: 'packages/core/src/mobile-config.ts',
    match: /palmart\.co\.ke/,
    reason: 'Example in a doc comment.',
  },
];
