// Load with: node --import ./packages/core/test/support/register.mjs --test <files>
// Lets the core/offline/Shopper TypeScript run under node:test against fake native modules.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
