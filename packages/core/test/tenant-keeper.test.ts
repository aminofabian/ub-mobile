import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshPhone } from './support/world.mjs';
import { configureStorage } from '../src/storage';
import { readTenantValue } from '../src/tenant-data';
import { dropTenantKeepers, tenantKeeper, type KeeperCodec } from '../src/tenant-keeper';

const codec: KeeperCodec<number> = {
  initial: 0,
  parse: (text) => (text === null ? 0 : Number(text)),
  serialize: (n) => (n === 0 ? null : String(n)),
};

beforeEach(() => {
  freshPhone({});
  configureStorage(null);
  dropTenantKeepers('acme');
  dropTenantKeepers('bobs');
});

test('every screen of a shop gets the same keeper for the same piece of data, and each shop its own', () => {
  const first = tenantKeeper('spoils', 'acme', codec);
  assert.equal(tenantKeeper('spoils', 'acme', codec), first);
  assert.notEqual(tenantKeeper('stockTake', 'acme', codec), first, 'another piece of data');
  assert.notEqual(tenantKeeper('spoils', 'bobs', codec), first, 'another shop');
});

test('what a keeper keeps is the shop\'s own, and nothing worth keeping removes what was kept', async () => {
  const keeper = tenantKeeper('spoils', 'acme', codec);
  await keeper.load(1);
  keeper.update(() => 7);
  assert.equal(await keeper.saved(), true);
  assert.equal(await readTenantValue('spoils', 'acme'), '7');
  assert.equal(await readTenantValue('spoils', 'bobs'), null, 'nothing in the other shop');
  keeper.update(() => 0);
  assert.equal(await keeper.saved(), true);
  assert.equal(await readTenantValue('spoils', 'acme'), null);
});

test('letting go of a shop\'s keepers leaves what is kept on the phone, and the other shops\' keepers', async () => {
  const mine = tenantKeeper('spoils', 'acme', codec);
  const other = tenantKeeper('spoils', 'bobs', codec);
  await mine.load(1);
  mine.update(() => 5);
  assert.equal(await mine.saved(), true);
  dropTenantKeepers('acme');
  assert.equal(tenantKeeper('spoils', 'bobs', codec), other, 'the other shop keeps its keeper');
  const again = tenantKeeper('spoils', 'acme', codec);
  assert.notEqual(again, mine, 'the shop gets a new one');
  assert.equal(await again.load(2), 5, 'which finds what was kept');
});

test('a shop whose name begins the same way as another is not let go with it', () => {
  const ac = tenantKeeper('spoils', 'ac', codec);
  const acme = tenantKeeper('spoils', 'acme', codec);
  dropTenantKeepers('ac');
  assert.equal(tenantKeeper('spoils', 'acme', codec), acme);
  assert.notEqual(tenantKeeper('spoils', 'ac', codec), ac);
  dropTenantKeepers('ac');
});
