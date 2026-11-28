import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { fetchPerformers, fetchServiceBook, fetchServices } from '../src/api/service-api';
import { isNoAnswer } from '../src/lib/reach';
import { servicesChangedBeforePay } from '../src/lib/service-check';
import { parsePerformers, parseServices, planService } from '../src/lib/service-sale';
import { describeServicesFailure, groupWords, basketWords } from '../src/lib/service-words';

type Handler = (path: string) => unknown;

/** A stand-in for the api client that records what it was asked and answers from `answer`. */
function fakeApi(answer: Handler) {
  const paths: string[] = [];
  const api = {
    get: async (path: string) => {
      paths.push(path);
      return answer(path);
    },
  };
  return { api: api as never, paths };
}

const row = (id: string) => ({ id, name: `Service ${id}`, price: 100, priceIsVariable: false, active: true, staffProfileIds: [], options: [] });

test('the services are asked for as the shop has them switched on, from the first page', async () => {
  const { api, paths } = fakeApi(() => ({ content: [row('a'), row('b')] }));
  const services = await fetchServices(api);
  assert.deepEqual(services.map((service) => service.id), ['a', 'b']);
  assert.deepEqual(paths, ['/api/v1/services?active=true&size=200&page=0']);
});

test('a full page asks for the next, and a short one is the last', async () => {
  const full = Array.from({ length: 200 }, (_, n) => row(`s${n}`));
  const { api, paths } = fakeApi((path) => (path.endsWith('page=0') ? { content: full } : { content: [row('last')] }));
  const services = await fetchServices(api);
  assert.equal(services.length, 201);
  assert.equal(paths.length, 2);
  assert.ok(paths[1]?.endsWith('page=1'));
});

test('a shop with endless pages is read as far as the limit and no further', async () => {
  const full = Array.from({ length: 200 }, (_, n) => row(`s${n}`));
  const { api, paths } = fakeApi((path) => ({ content: full.map((entry) => ({ ...entry, id: `${path}-${entry.id}`.replace(/[^A-Za-z0-9-]/g, '') })) }));
  await fetchServices(api);
  assert.equal(paths.length, 5);
});

test('rows the till cannot sell are left out of what it reads', async () => {
  const { api } = fakeApi(() => ({ content: [row('a'), { ...row('b'), price: 0 }, null, 'x'] }));
  assert.deepEqual((await fetchServices(api)).map((service) => service.id), ['a']);
});

test('the staff who can be named are asked for, and read from a plain list', async () => {
  const { api, paths } = fakeApi(() => [{ staffProfileId: 'p-1', displayName: 'Wanjiku' }]);
  assert.deepEqual(await fetchPerformers(api), [{ id: 'p-1', name: 'Wanjiku' }]);
  assert.deepEqual(paths, ['/api/v1/services/performers']);
});

test('the services and the staff are read together for one shop, with the time they were read', async () => {
  const { api } = fakeApi((path) => (path.includes('performers') ? [{ staffProfileId: 'p-1', displayName: 'Wanjiku' }] : { content: [row('a')] }));
  const book = await fetchServiceBook(api, 'tenant-1', 1234);
  assert.deepEqual(book, { tenantId: 'tenant-1', services: [book.services[0]], performers: [{ id: 'p-1', name: 'Wanjiku' }], asOf: 1234 });
  assert.equal(book.services[0]?.id, 'a');
});

test('if either list cannot be read, there is no list: a service cannot be sold without someone to name on it', async () => {
  const { api } = fakeApi((path) => {
    if (path.includes('performers')) throw new ApiError('Forbidden', { status: 403 });
    return { content: [row('a')] };
  });
  await assert.rejects(fetchServiceBook(api, 'tenant-1', 1), (error: unknown) => error instanceof ApiError && error.status === 403);
});

test('and if the services cannot be read there is no list either, though the staff could be', async () => {
  const { api } = fakeApi((path) => {
    if (path.includes('performers')) return [{ staffProfileId: 'p-1', displayName: 'Wanjiku' }];
    throw new ApiError('Server error', { status: 500 });
  });
  await assert.rejects(fetchServiceBook(api, 'tenant-1', 1), (error: unknown) => error instanceof ApiError && error.status === 500);
});

test('a failure to read the services is said in the till\'s own words', () => {
  assert.match(describeServicesFailure(new ApiError('Forbidden', { status: 403 })), /not allowed to see the services/);
  assert.match(describeServicesFailure(new Error('timeout')), /Check the connection/);
  assert.match(describeServicesFailure(null), /has not kept a list yet/);
});

test('what went wrong is told apart: nobody answered, the shop said no to the role, or the shop could not do it', () => {
  const forbidden = new ApiError('Forbidden', { status: 403 });
  const broken = new ApiError('Server error', { status: 500 });
  const gateway = new ApiError('Bad gateway', { status: 502 });
  const loginPage = new ApiError('Forbidden', { status: 403, foreign: true });
  // No list yet.
  assert.match(describeServicesFailure(forbidden), /not allowed to see the services/);
  assert.match(describeServicesFailure(broken), /could not give the services/);
  assert.doesNotMatch(describeServicesFailure(broken), /Check the connection/, 'the shop answered: the connection is not the problem');
  assert.match(describeServicesFailure(gateway), /Check the connection/, 'a gateway with nothing behind it is no answer');
  assert.match(describeServicesFailure(loginPage), /Check the connection/, 'a Wi-Fi sign-in page saying 403 is not the shop saying it');
  // A list is on the screen: it is not said that none was kept.
  for (const error of [forbidden, broken, gateway, null]) {
    assert.doesNotMatch(describeServicesFailure(error, true), /has not kept a list/, String(error));
  }
  assert.match(describeServicesFailure(forbidden, true), /not allowed to see the services/);
  assert.match(describeServicesFailure(broken, true), /list below is the one read earlier/);
});

test('a question on a service says what it asks of the cashier', () => {
  const group = { id: 'g', name: 'Length', options: [] };
  assert.equal(groupWords({ ...group, required: true, multiple: false }), 'choose one');
  assert.equal(groupWords({ ...group, required: true, multiple: true }), 'choose at least one');
  assert.equal(groupWords({ ...group, required: false, multiple: true }), 'choose any');
  assert.equal(groupWords({ ...group, required: false, multiple: false }), 'optional');
});

test('the basket is counted for the bottom of the list', () => {
  assert.equal(basketWords(0, null), 'The basket is empty.');
  assert.equal(basketWords(1, '300.00'), '1 item in the basket, 300.00.');
  assert.equal(basketWords(3, '1,300.00'), '3 items in the basket, 1,300.00.');
  assert.equal(basketWords(2, null), '2 items in the basket.');
});

test('a page with far more rows than was asked for is cut to the page, and the staff list to a sane length', async () => {
  const huge = Array.from({ length: 1_000_000 }, () => null);
  const { api, paths } = fakeApi(() => ({ content: huge }));
  assert.deepEqual(await fetchServices(api), []);
  assert.equal(paths.length, 5, 'still no more than five pages');
  const crowd = Array.from({ length: 1000 }, (_, n) => ({ staffProfileId: `p${n}`, displayName: `Person ${n}` }));
  const people = await fetchPerformers(fakeApi(() => crowd).api);
  assert.equal(people.length, 500);
  assert.equal(people[0]?.id, 'p0');
  assert.equal(people[499]?.id, 'p499');
});

test('an answer that is not a list is not an empty list: the shop answered, but the till cannot read it', async () => {
  for (const body of [undefined, null, {}, 'ok', 42, true, { status: 'ok' }, { content: 'x' }, { content: null }, { items: {} }]) {
    const { api } = fakeApi(() => body);
    for (const read of [() => fetchServices(api), () => fetchPerformers(api), () => fetchServiceBook(api, 't-1', 1)]) {
      await assert.rejects(
        read(),
        (error: unknown) => {
          if (!(error instanceof ApiError)) return false;
          assert.equal(error.status, 200);
          assert.equal(isNoAnswer(error), false, 'the shop did answer');
          return true;
        },
        JSON.stringify(body)
      );
    }
  }
});

test('an empty page, an empty `items` wrapper and an empty bare list are the shop having none, and are read as that', async () => {
  for (const body of [{ content: [] }, { items: [] }, []]) {
    const { api } = fakeApi(() => body);
    assert.deepEqual(await fetchServices(api), [], JSON.stringify(body));
    assert.deepEqual(await fetchPerformers(api), [], JSON.stringify(body));
  }
});

test('a later page that cannot be read fails the whole read: a list cut short is not the shop\'s list', async () => {
  const full = Array.from({ length: 200 }, (_, n) => row(`s${n}`));
  const { api } = fakeApi((path) => (path.endsWith('page=0') ? { content: full } : {}));
  await assert.rejects(fetchServices(api), (error: unknown) => error instanceof ApiError && error.status === 200);
});

test('what is said of an answer that is not a list is the shop\'s doing, not the connection\'s', async () => {
  const error = await fetchServices(fakeApi(() => ({})).api).catch((caught: unknown) => caught);
  assert.match(describeServicesFailure(error), /could not give the services/);
  assert.doesNotMatch(describeServicesFailure(error), /Check the connection/);
  assert.match(describeServicesFailure(error, true), /list below is the one read earlier/);
});

test('a basket is not found full of services that are "not sold any more" because the shop answered with something unreadable', async () => {
  const held = {
    tenantId: 't-1',
    services: parseServices([row('a')]),
    performers: parsePerformers([{ staffProfileId: 'p-1', displayName: 'Wanjiku' }]),
    asOf: 1,
  };
  const one = held.services[0];
  assert.ok(one);
  const plan = planService(one, held.performers, { performerId: 'p-1', optionIds: [], quantity: 1, typedCents: null });
  if (!plan.ok) throw new Error(plan.why);
  const cart = [plan.line];
  const later = 10 * 60_000;
  const check = (body: unknown) =>
    servicesChangedBeforePay({
      cart: () => cart,
      held: () => held,
      offline: () => false,
      read: () => fetchServiceBook(fakeApi(() => body).api, 't-1', later),
      keep: () => assert.fail('an answer that was not read is not kept'),
      now: () => later,
    });
  assert.deepEqual(await check({}), [], 'what is held is gone on with');
  assert.deepEqual(await check(undefined), []);
  // A real, empty answer is the shop saying it sells nothing, and then the service in the basket is not sold.
  const empty = fakeApi((path) => (path.includes('performers') ? [{ staffProfileId: 'p-1', displayName: 'Wanjiku' }] : { content: [] }));
  const changes = await servicesChangedBeforePay({
    cart: () => cart,
    held: () => held,
    offline: () => false,
    read: () => fetchServiceBook(empty.api, 't-1', later),
    keep: () => undefined,
    now: () => later,
  });
  assert.deepEqual(changes.map((change) => change.kind), ['gone']);
});
