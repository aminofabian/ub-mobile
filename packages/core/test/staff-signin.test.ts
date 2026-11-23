import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshPhone, installFetch } from './support/world.mjs';
import { configureStorage } from '../src/storage';
import { ApiError, isApiError, readApiError } from '../src/problem';
import { createApiClient, type ApiClient } from '../src/create-api-client';
import { endSession, fetchBranches, loginWithPassword, loginWithPin, logout, refreshAccessToken, registerAccount, resendVerificationEmail } from '../src/auth-service';
import { getAccessToken, getRefreshToken, sessionWasEnded } from '../src/auth';
import { openStore } from '../src/tenant';
import { parseMe, parseSignedInUser } from '../src/staff-user';
import { fetchMe, fetchShiftsDisabled, readShiftsDisabled, shiftsAreDisabled } from '../src/staff-session';
import { ACME, API, BOBS, mobileBody, mobileUrl } from './fixtures';

type Handle = {
  calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: unknown }>;
  restore(): void;
};
let net: Handle | null = null;

beforeEach(() => {
  freshPhone({});
  configureStorage(null);
});

afterEach(() => {
  net?.restore();
  net = null;
});

function serve(routes: unknown[]): Handle {
  net?.restore();
  net = installFetch([[mobileUrl('acme'), { status: 200, body: mobileBody(ACME) }], ...routes]) as Handle;
  return net;
}

async function openAcme() {
  const result = await openStore('acme', API, { audience: 'staff' });
  assert.equal(result.kind, 'opened', JSON.stringify(result));
}

const PERSON = {
  id: 'u-1',
  email: 'Wanjiru@Acme.Test',
  name: 'Wanjiru Kamau',
  phone: '0711000000',
  status: 'ACTIVE',
  businessId: ACME.tenantId,
  branchId: 'b-1',
  hasPin: true,
  role: { id: 'r-1', key: 'cashier', name: 'Cashier', system: true },
  permissions: ['sales.sell', 'shifts.open', 'Sales.Sell', 'pos.drafts.write'],
};

function answer(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------------------------
// Structured errors
// ---------------------------------------------------------------------------------------------

test('an error answer keeps its status, code, requirement and hint, and the same message as before', async () => {
  const error = await readApiError(
    answer(403, {
      title: 'Forbidden',
      detail: 'Open a shift before selling.',
      status: 403,
      code: 'setup_required',
      requirement: 'shift',
      hint: 'open',
    })
  );
  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 403);
  assert.equal(error.code, 'setup_required');
  assert.equal(error.requirement, 'shift');
  assert.equal(error.hint, 'open');
  assert.equal(error.message, 'Open a shift before selling.');
  assert.equal(isApiError(error), true);
});

test('an error answer with no JSON, or no body, still says something and keeps its status', async () => {
  const plain = await readApiError(answer(502, 'Bad gateway'));
  assert.equal(plain.message, 'Bad gateway');
  assert.equal(plain.status, 502);
  assert.equal(plain.code, undefined);
  const empty = await readApiError(answer(503, ''));
  assert.equal(empty.message, 'Request failed (503)');
  assert.equal(empty.status, 503);
});

test('only a real api error is one: a lookalike with the same name and a status counts, a plain error does not', () => {
  assert.equal(isApiError(new Error('x')), false);
  assert.equal(isApiError('x'), false);
  assert.equal(isApiError(null), false);
  assert.equal(isApiError({ name: 'ApiError', status: 403 }), false, 'not an Error');
  assert.equal(isApiError(Object.assign(new Error('x'), { name: 'ApiError', status: 403 })), true);
  assert.equal(isApiError(Object.assign(new Error('x'), { name: 'ApiError' })), false);
  assert.equal(isApiError(Object.assign(new Error('x'), { status: 500 })), false, 'a status alone does not make one');
});

test('the api client throws an error that carries what the server said', async () => {
  serve([
    [
      `${API}/api/v1/sales`,
      {
        status: 403,
        body: { title: 'Forbidden', detail: 'Pair this phone first.', status: 403, code: 'setup_required', requirement: 'till' },
      },
    ],
  ]);
  await openAcme();
  const api = createApiClient({ baseURL: API });
  await assert.rejects(
    api.get('/api/v1/sales'),
    (error: unknown) =>
      isApiError(error) &&
      error.status === 403 &&
      error.code === 'setup_required' &&
      error.requirement === 'till' &&
      /Pair this phone first/.test(error.message)
  );
});

test('sign-in, registration and resend failures keep their status and code too', async () => {
  serve([
    [`${API}/api/v1/auth/login-pin`, { status: 403, body: { title: 'Forbidden', detail: 'This phone is not a registered till.', status: 403, code: 'till_not_registered' } }],
    [`${API}/api/v1/auth/login`, { status: 401, body: { title: 'Unauthorized', detail: 'Incorrect email or password.', status: 401 } }],
    [`${API}/api/v1/auth/register`, { status: 409, body: { title: 'Conflict', detail: 'That email is already registered.', status: 409, code: 'email_taken' } }],
    [`${API}/api/v1/auth/resend-verification`, { status: 429, body: { title: 'Too Many Requests', detail: 'Wait a minute.', status: 429 } }],
  ]);
  await openAcme();
  await assert.rejects(loginWithPassword(API, 'a@b.co', 'pw'), (e: unknown) => isApiError(e) && e.status === 401 && e.message === 'Incorrect email or password.');
  await assert.rejects(loginWithPin(API, 'a@b.co', '1234'), (e: unknown) => isApiError(e) && e.status === 403 && e.code === 'till_not_registered');
  await assert.rejects(registerAccount(API, 'A', 'a@b.co', 'pw'), (e: unknown) => isApiError(e) && e.status === 409 && e.code === 'email_taken');
  await assert.rejects(resendVerificationEmail(API, 'a@b.co'), (e: unknown) => isApiError(e) && e.status === 429);
});

// ---------------------------------------------------------------------------------------------
// Sign-in answers
// ---------------------------------------------------------------------------------------------

test('a sign-in returns the person the server named, with the branch it assigned', async () => {
  serve([
    [
      `${API}/api/v1/auth/login-pin`,
      {
        status: 200,
        body: {
          accessToken: 'tok',
          refreshToken: 'ref',
          user: { id: 'u-1', email: 'Wanjiru@Acme.Test', name: 'Wanjiru Kamau', businessId: ACME.tenantId, branchId: 'b-1', roleId: 'r-1', status: 'ACTIVE' },
        },
      },
    ],
  ]);
  await openAcme();
  const result = await loginWithPin(API, 'wanjiru@acme.test', '1234');
  assert.deepEqual(result, { user: { id: 'u-1', email: 'wanjiru@acme.test', name: 'Wanjiru Kamau', branchId: 'b-1' } });
});

test('a password sign-in returns the person too', async () => {
  serve([
    [
      `${API}/api/v1/auth/login`,
      { status: 200, body: { accessToken: 'tok', refreshToken: 'ref', user: { id: 'u-2', email: 'Owner@Acme.Test', name: 'Mary Achieng', branchId: null } } },
    ],
  ]);
  await openAcme();
  assert.deepEqual(await loginWithPassword(API, 'owner@acme.test', 'pw'), {
    user: { id: 'u-2', email: 'owner@acme.test', name: 'Mary Achieng', branchId: null },
  });
});

test('a sign-in answer with no user still signs in, and says the person is unknown', async () => {
  serve([[`${API}/api/v1/auth/login`, { status: 200, body: { accessToken: 'tok', refreshToken: 'ref' } }]]);
  await openAcme();
  assert.deepEqual(await loginWithPassword(API, 'a@b.co', 'pw'), { user: null });
});

test('a PIN sign-in sends no branch unless a real one is given, and never a placeholder', async () => {
  const handle = serve([[`${API}/api/v1/auth/login-pin`, { status: 200, body: { accessToken: 't', refreshToken: 'r' } }]]);
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  await loginWithPin(API, 'a@b.co', '1234', 'default');
  await loginWithPin(API, 'a@b.co', '1234', '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  const bodies = handle.calls.filter((c) => c.url.endsWith('/login-pin')).map((c) => JSON.parse(String(c.body)));
  assert.deepEqual(bodies[0], { email: 'a@b.co', pin: '1234' });
  assert.deepEqual(bodies[1], { email: 'a@b.co', pin: '1234' });
  assert.deepEqual(bodies[2], { email: 'a@b.co', pin: '1234', branchId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' });
});

test('what the server says about a person is read defensively', () => {
  assert.equal(parseSignedInUser(null), null);
  assert.equal(parseSignedInUser({}), null);
  assert.equal(parseSignedInUser({ id: 7 }), null);
  assert.equal(parseSignedInUser({ id: 'x'.repeat(65) }), null);
  assert.deepEqual(parseSignedInUser({ id: 'u', email: ' A@B.CO ', name: 'A‮B', branchId: '' }), {
    id: 'u',
    email: 'a@b.co',
    name: 'AB',
    branchId: null,
  });
});

// ---------------------------------------------------------------------------------------------
// /me
// ---------------------------------------------------------------------------------------------

test('/me is read into a person: permissions lower case and once each, names cleaned, PIN only when true', () => {
  assert.deepEqual(parseMe(PERSON), {
    id: 'u-1',
    email: 'wanjiru@acme.test',
    name: 'Wanjiru Kamau',
    branchId: 'b-1',
    roleKey: 'cashier',
    roleName: 'Cashier',
    permissions: ['sales.sell', 'shifts.open', 'pos.drafts.write'],
    hasPin: true,
  });
  assert.equal(parseMe({ ...PERSON, hasPin: 'true' })?.hasPin, false);
  assert.equal(parseMe({ ...PERSON, hasPin: 1 })?.hasPin, false);
  assert.equal(parseMe({ ...PERSON, branchId: null })?.branchId, null);
});

test('/me that is not a person with a role is refused, and nonsense permissions never get in', () => {
  assert.equal(parseMe(null), null);
  assert.equal(parseMe('x'), null);
  assert.equal(parseMe({ ...PERSON, id: undefined }), null);
  assert.equal(parseMe({ ...PERSON, role: { key: '' } }), null);
  assert.equal(parseMe({ ...PERSON, role: 'cashier' }), null);
  assert.equal(parseMe({ ...PERSON, role: 7 }), null);
  const odd = parseMe({
    ...PERSON,
    permissions: ['sales.sell', 42, null, '', '  ', 'has space', 'x'.repeat(81), '*', '../etc', 'Pos.Drafts.Write'],
  });
  assert.deepEqual(odd?.permissions, ['sales.sell', 'pos.drafts.write']);
  assert.deepEqual(parseMe({ ...PERSON, permissions: 'sales.sell' })?.permissions, []);
});

test('an account with no role is a person with nothing to open, whatever permissions the answer lists', () => {
  const roleless = { id: 'u-1', email: 'Wanjiru@Acme.Test', name: 'Wanjiru Kamau', branchId: null, hasPin: false, permissions: ['sales.sell'] };
  for (const role of [null, undefined]) {
    assert.deepEqual(parseMe({ ...roleless, role }), {
      id: 'u-1',
      email: 'wanjiru@acme.test',
      name: 'Wanjiru Kamau',
      branchId: null,
      roleKey: '',
      roleName: '',
      permissions: [],
      hasPin: false,
    });
  }
});

test('a name with hidden characters or extra spaces is cleaned before it is shown', () => {
  assert.equal(parseMe({ ...PERSON, name: 'Wan\u202ejiru   \u200bKamau ' })?.name, 'Wanjiru Kamau');
  assert.equal(parseMe({ ...PERSON, name: 'x'.repeat(200) })?.name.length, 60);
  assert.equal(parseMe({ ...PERSON, name: 42 })?.name, '');
});

test('a huge list of permissions is capped, and a role with no name shows its key', () => {
  const many = Array.from({ length: 2000 }, (_, i) => `perm.n${i}`);
  assert.equal(parseMe({ ...PERSON, permissions: many })?.permissions.length, 500);
  assert.equal(parseMe({ ...PERSON, role: { key: 'weird_custom', name: '' } })?.roleName, 'weird_custom');
});

test('fetchMe asks the server who is signed in, and refuses an answer that is not a person', async () => {
  const good = { get: async (path: string) => (path === '/api/v1/me' ? PERSON : null) } as unknown as ApiClient;
  assert.equal((await fetchMe(good)).roleKey, 'cashier');
  const bad = { get: async () => ({ hello: 'world' }) } as unknown as ApiClient;
  await assert.rejects(fetchMe(bad), /Could not read your account/);
  const down = {
    get: async () => {
      throw new ApiError('Request failed (503)', { status: 503 });
    },
  } as unknown as ApiClient;
  await assert.rejects(fetchMe(down), (e: unknown) => isApiError(e) && e.status === 503);
});

test('the shop\'s public feature flags say shifts are off only with a real true', () => {
  assert.equal(readShiftsDisabled({ featureFlags: { 'shifts.disabled': true } }), true);
  assert.equal(readShiftsDisabled({ featureFlags: { 'shifts.disabled': false } }), false);
  assert.equal(readShiftsDisabled({ featureFlags: { 'shifts.disabled': 'true' } }), false);
  assert.equal(readShiftsDisabled({ featureFlags: { shiftsDisabled: true } }), false);
  assert.equal(readShiftsDisabled({ featureFlags: {} }), false);
  assert.equal(readShiftsDisabled({ featureFlags: null }), false);
  assert.equal(readShiftsDisabled({ featureFlags: 'shifts.disabled' }), false);
  assert.equal(readShiftsDisabled({}), false);
  assert.equal(readShiftsDisabled(null), false);
  assert.equal(readShiftsDisabled('x'), false);
});

test('whether shifts are off is asked of the shop\'s public address, and any failure means they are on', async () => {
  const resolve = `${API}/api/v1/public/host/resolve?host=${encodeURIComponent(ACME.host)}`;
  const off = serve([[resolve, { status: 200, body: { featureFlags: { 'shifts.disabled': true, other: false } } }]]);
  assert.equal(await fetchShiftsDisabled(API, ACME.host), true);
  assert.equal(off.calls.filter((c) => c.url === resolve).length, 1);
  assert.equal(off.calls.find((c) => c.url === resolve)?.method, 'GET');

  serve([[resolve, { status: 200, body: { featureFlags: { 'shifts.disabled': false } } }]]);
  assert.equal(await fetchShiftsDisabled(API, ACME.host), false);
  serve([[resolve, { status: 404, body: {} }]]);
  assert.equal(await fetchShiftsDisabled(API, ACME.host), false);
  serve([[resolve, { status: 503, body: {} }]]);
  assert.equal(await fetchShiftsDisabled(API, ACME.host), false);
  serve([[resolve, { status: 200, body: {}, invalidJson: true }]]);
  assert.equal(await fetchShiftsDisabled(API, ACME.host), false);
  serve([[resolve, () => { throw new TypeError('Network request failed'); }]]);
  assert.equal(await fetchShiftsDisabled(API, ACME.host), false);
});

test('a shop with no address is never asked about, and a trailing slash on the server address does no harm', async () => {
  const handle = serve([['', { status: 200, body: { featureFlags: { 'shifts.disabled': true } } }]]);
  const before = handle.calls.length;
  assert.equal(await fetchShiftsDisabled(API, undefined), false);
  assert.equal(await fetchShiftsDisabled(API, '   '), false);
  assert.equal(handle.calls.length, before);
  assert.equal(await fetchShiftsDisabled(`${API}///`, ACME.host), true);
  assert.ok(handle.calls.some((c) => c.url === `${API}/api/v1/public/host/resolve?host=${encodeURIComponent(ACME.host)}`));
});

// ---------------------------------------------------------------------------------------------
// Ending a session
// ---------------------------------------------------------------------------------------------

const settle = () => new Promise((resolve) => setTimeout(resolve, 15));

test('ending a session clears the phone at once, and tells the server with the token the phone held', async () => {
  let logins = 0;
  let release: (() => void) | undefined;
  const handle = serve([
    [
      `${API}/api/v1/auth/login-pin`,
      () => {
        logins += 1;
        return { status: 200, body: { accessToken: `access-${logins}`, refreshToken: `refresh-${logins}` } };
      },
    ],
    [
      `${API}/api/v1/auth/logout`,
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: 204, body: null });
        }),
    ],
  ]);
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  assert.equal(await getAccessToken(), 'access-1');

  // The server has not answered, and the phone has already let go.
  await endSession(API);
  assert.equal(await getAccessToken(), null);
  assert.equal(await getRefreshToken(), null);
  await settle();
  const logout = handle.calls.find((c) => c.url.endsWith('/api/v1/auth/logout'));
  assert.ok(logout, 'the server is told');
  assert.equal(logout.method, 'POST');
  assert.equal(logout.headers.Authorization, 'Bearer access-1');

  // The next person signs in. The old answer, arriving late, must not touch their session.
  await loginWithPin(API, 'c@d.co', '4321');
  assert.equal(await getAccessToken(), 'access-2');
  release?.();
  await settle();
  assert.equal(await getAccessToken(), 'access-2');
  assert.equal(await getRefreshToken(), 'refresh-2');
});

test('a sign-in the server never answers is given up on after 30 seconds, and reads as no connection', async (t) => {
  let signal: AbortSignal | undefined;
  serve([
    [
      `${API}/api/v1/auth/login-pin`,
      (_href: string, init: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal = init.signal;
          init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
        }),
    ],
  ]);
  await openAcme();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const outcome = loginWithPin(API, 'a@b.co', '1234').then(
    () => 'signed in',
    (error: unknown) => error
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(signal, 'the request was sent with a signal');
  t.mock.timers.tick(29_999);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  assert.equal(signal.aborted, true);
  const error = await outcome;
  assert.equal(error instanceof Error && error.name, 'AbortError');
  assert.equal(await getAccessToken(), null, 'nothing was stored');
});

test('a sign-in answered after the person moved to another shop stores nothing, and ends the session it made', async () => {
  let release!: (response: unknown) => void;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const handle = serve([
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
    [`${API}/api/v1/auth/login-pin`, () => held],
    [`${API}/api/v1/auth/logout`, { status: 204, body: '' }],
  ]);
  await openAcme();
  const outcome = loginWithPin(API, 'a@b.co', '1234').then(
    () => 'signed in',
    (error: unknown) => error
  );
  await settle();
  const moved = await openStore('bobs', API, { audience: 'staff' });
  assert.equal(moved.kind, 'opened');

  release({ status: 200, body: { accessToken: 'acme-token', refreshToken: 'acme-refresh', user: PERSON } });
  const error = await outcome;
  assert.ok(error instanceof Error, 'the caller is told the answer was not used');
  assert.equal(error.name, 'AbortError');
  assert.equal(await getAccessToken(ACME.tenantId), null, 'nothing is kept for the shop that was left');
  assert.equal(await getAccessToken(BOBS.tenantId), null, 'and nothing is handed to the shop that is open');
  assert.equal(await getRefreshToken(ACME.tenantId), null);
  assert.equal(await getRefreshToken(BOBS.tenantId), null);

  await settle();
  const ended = handle.calls.find((call) => call.url.endsWith('/api/v1/auth/logout'));
  assert.ok(ended, 'the server is asked to end the session it just made');
  assert.equal(ended.headers['Authorization'], 'Bearer acme-token', 'with the token it was given');
  assert.equal(ended.headers['X-Tenant-Id'], ACME.tenantId, 'for the shop it was made at, not the one open now');
});

test('a sign-in answered while the same shop is still open is kept, with no sign-out sent', async () => {
  const handle = serve([[`${API}/api/v1/auth/login-pin`, { status: 200, body: { accessToken: 'tok', refreshToken: 'ref', user: PERSON } }]]);
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  assert.equal(await getAccessToken(ACME.tenantId), 'tok');
  await settle();
  assert.equal(handle.calls.filter((call) => call.url.endsWith('/auth/logout')).length, 0);
});

test('a password sign-in answered after the person moved to another shop is not kept either', async () => {
  let release!: (response: unknown) => void;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  serve([
    [mobileUrl('bobs'), { status: 200, body: mobileBody(BOBS) }],
    [`${API}/api/v1/auth/login`, () => held],
    [`${API}/api/v1/auth/logout`, { status: 204, body: '' }],
  ]);
  await openAcme();
  const outcome = loginWithPassword(API, 'a@b.co', 'secret').then(
    () => 'signed in',
    (error: unknown) => error
  );
  await settle();
  await openStore('bobs', API, { audience: 'staff' });
  release({ status: 200, body: { accessToken: 'acme-token', refreshToken: 'acme-refresh', user: PERSON } });
  assert.equal((await outcome as Error).name, 'AbortError');
  assert.equal(await getAccessToken(ACME.tenantId), null);
});

// An access token lasts an hour and the server ends a session only for one it still accepts.
function expiredToken(logoutAnswers: { renewal: { status: number; body: unknown }; later?: number }) {
  const log: string[] = [];
  const handle = serve([
    [`${API}/api/v1/auth/login-pin`, { status: 200, body: { accessToken: 'old-access', refreshToken: 'refresh-1' } }],
    [
      `${API}/api/v1/auth/refresh`,
      (_href: string, init: { body?: string }) => {
        log.push(`refresh ${init.body}`);
        return logoutAnswers.renewal;
      },
    ],
    [
      `${API}/api/v1/auth/logout`,
      (_href: string, init: { headers: Record<string, string> }) => {
        log.push(`logout ${init.headers.Authorization}`);
        return init.headers.Authorization === 'Bearer old-access' ? { status: 401, body: {} } : { status: logoutAnswers.later ?? 204, body: null };
      },
    ],
  ]);
  return { handle, log };
}

test('signing out with an access token that has run out gets a fresh one and ends the session at the server anyway', async () => {
  const { log } = expiredToken({ renewal: { status: 200, body: { accessToken: 'new-access', refreshToken: 'refresh-2' } } });
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  await endSession(API);
  assert.equal(await getAccessToken(), null, 'the phone let go at once');
  assert.equal(await getRefreshToken(), null);
  await settle();
  await settle();
  assert.deepEqual(log, ['logout Bearer old-access', 'refresh {"refreshToken":"refresh-1"}', 'logout Bearer new-access']);
  assert.equal(await getAccessToken(), null, 'the fresh token is used once and never kept');
  assert.equal(await getRefreshToken(), null);
});

test('when the session cannot be renewed either, nothing more is tried and nothing is thrown', async () => {
  const { log } = expiredToken({ renewal: { status: 401, body: {} } });
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  await endSession(API);
  await settle();
  await settle();
  assert.deepEqual(log, ['logout Bearer old-access', 'refresh {"refreshToken":"refresh-1"}']);
  assert.equal(await getAccessToken(), null);
});

test('a renewal the server refused is not used, even when the answer carries a token', async () => {
  const { log } = expiredToken({ renewal: { status: 401, body: { accessToken: 'trap-access', refreshToken: 'trap-refresh' } } });
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  await endSession(API);
  await settle();
  await settle();
  assert.deepEqual(log, ['logout Bearer old-access', 'refresh {"refreshToken":"refresh-1"}'], 'no sign-out is sent with a token from a refused answer');
});

/** A route that never answers, and hands out the signal of the request so a test can see when it was given up on. */
function neverAnswers(onSignal: (signal: AbortSignal | undefined) => void) {
  return (_href: string, init: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      onSignal(init.signal);
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    });
}

test('by default the server is given 8 seconds to note a sign-out, and then the request is dropped', async (t) => {
  let signal: AbortSignal | undefined;
  serve([
    [`${API}/api/v1/auth/login-pin`, { status: 200, body: { accessToken: 'a', refreshToken: 'r' } }],
    [`${API}/api/v1/auth/logout`, neverAnswers((given) => { signal = given; })],
  ]);
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await endSession(API);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(signal, 'the request was sent');
  t.mock.timers.tick(7_999);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  assert.equal(signal.aborted, true);
});

test('the list of branches is given 20 seconds, and then the wait ends like a lost connection', async (t) => {
  let signal: AbortSignal | undefined;
  serve([[`${API}/api/v1/auth/branches`, neverAnswers((given) => { signal = given; })]]);
  await openAcme();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const outcome = fetchBranches(API).then(
    () => 'listed',
    (error: unknown) => error
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(signal, 'the request was sent');
  t.mock.timers.tick(19_999);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  assert.equal(signal.aborted, true);
  const error = await outcome;
  assert.equal(error instanceof Error && error.name, 'AbortError');
});

test('a sign-out the server accepts needs no renewal, and a phone with no refresh token does not try one', async () => {
  const fine = serve([
    [`${API}/api/v1/auth/login-pin`, { status: 200, body: { accessToken: 'a', refreshToken: 'r' } }],
    [`${API}/api/v1/auth/logout`, { status: 204, body: null }],
    [`${API}/api/v1/auth/refresh`, { status: 200, body: { accessToken: 'x', refreshToken: 'y' } }],
  ]);
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  await endSession(API);
  await settle();
  assert.deepEqual(fine.calls.filter((c) => c.url.includes('/auth/')).map((c) => c.url.split('/auth/')[1]), ['login-pin', 'logout']);

  const none = serve([
    [`${API}/api/v1/auth/login-pin`, { status: 200, body: { accessToken: 'only-access' } }],
    [`${API}/api/v1/auth/logout`, { status: 401, body: {} }],
    [`${API}/api/v1/auth/refresh`, { status: 200, body: { accessToken: 'x', refreshToken: 'y' } }],
  ]);
  await loginWithPin(API, 'a@b.co', '1234');
  await endSession(API);
  await settle();
  assert.equal(none.calls.filter((c) => c.url.endsWith('/auth/refresh')).length, 0, 'there is no refresh token to renew with');
});

test('after a sign-out nothing already on its way can sign the phone in again, and the next sign-in clears that', async () => {
  const handle = serve([
    [`${API}/api/v1/auth/login-pin`, { status: 200, body: { accessToken: 'a-1', refreshToken: 'r-1' } }],
    [`${API}/api/v1/auth/logout`, { status: 204, body: null }],
    // What the server would answer from the phone's cookie, to a refresh that carries no token of its own.
    [`${API}/api/v1/auth/refresh`, { status: 200, body: { accessToken: 'revived', refreshToken: 'revived-r' } }],
  ]);
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  assert.equal(sessionWasEnded(ACME.tenantId), false);
  await endSession(API);
  assert.equal(sessionWasEnded(ACME.tenantId), true);
  await settle();

  const calls = () => handle.calls.filter((c) => c.url.endsWith('/auth/refresh')).length;
  assert.deepEqual(await refreshAccessToken(API), { kind: 'rejected' }, 'a late 401 cannot refresh a signed-out phone');
  assert.equal(calls(), 0, 'and the server is not even asked');
  assert.equal(await getAccessToken(), null, 'nothing was brought back');

  await loginWithPin(API, 'c@d.co', '4321');
  assert.equal(sessionWasEnded(ACME.tenantId), false, 'a new sign-in is a session again');
  assert.deepEqual(await refreshAccessToken(API), { kind: 'ok' });
  assert.equal(calls(), 1);
});

test('the shopper\'s sign-out guards against a late refresh the same way', async () => {
  serve([
    [`${API}/api/v1/auth/login`, { status: 200, body: { accessToken: 'a-1', refreshToken: 'r-1' } }],
    [`${API}/api/v1/auth/logout`, { status: 204, body: null }],
    [`${API}/api/v1/auth/refresh`, { status: 200, body: { accessToken: 'revived', refreshToken: 'revived-r' } }],
  ]);
  await openAcme();
  await loginWithPassword(API, 'a@b.co', 'secret');
  await logout(API);
  assert.equal(await getAccessToken(), null);
  assert.deepEqual(await refreshAccessToken(API), { kind: 'rejected' });
  assert.equal(await getAccessToken(), null);
});

test('with no connection the phone is still signed out, and nothing is thrown', async () => {
  serve([
    [`${API}/api/v1/auth/login-pin`, { status: 200, body: { accessToken: 'a', refreshToken: 'r' } }],
    [`${API}/api/v1/auth/logout`, () => { throw new TypeError('Network request failed'); }],
  ]);
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  await endSession(API);
  await settle();
  assert.equal(await getAccessToken(), null);
  assert.equal(await getRefreshToken(), null);
});

test('with no session on the phone the server is not asked, and with no shop open nothing happens', async () => {
  const handle = serve([[`${API}/api/v1/auth/logout`, { status: 204, body: null }]]);
  await endSession(API); // no shop open yet
  await openAcme();
  await endSession(API); // a shop, but nobody signed in
  await settle();
  assert.equal(handle.calls.filter((c) => c.url.endsWith('/api/v1/auth/logout')).length, 0);
});

test('a server that never answers is given up on after the time limit', async () => {
  let signal: AbortSignal | undefined;
  serve([
    [`${API}/api/v1/auth/login-pin`, { status: 200, body: { accessToken: 'a', refreshToken: 'r' } }],
    [
      `${API}/api/v1/auth/logout`,
      (_href: string, init: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal = init.signal;
          init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
    ],
  ]);
  await openAcme();
  await loginWithPin(API, 'a@b.co', '1234');
  const started = Date.now();
  await endSession(API, { timeoutMs: 80 });
  assert.ok(Date.now() - started < 50, 'the person does not wait for the server');
  await settle();
  assert.ok(signal, 'the request was sent');
  assert.equal(signal.aborted, false);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(signal.aborted, true);
  assert.equal(await getAccessToken(), null);
});

test('shifts are off only when the shop says so with a true', () => {
  assert.equal(shiftsAreDisabled({ capabilities: { shiftsDisabled: true } }), true);
  assert.equal(shiftsAreDisabled({ capabilities: { shiftsDisabled: false } }), false);
  assert.equal(shiftsAreDisabled({ capabilities: {} }), false);
  assert.equal(shiftsAreDisabled({}), false);
  assert.equal(shiftsAreDisabled(null), false);
  assert.equal(shiftsAreDisabled(undefined), false);
  assert.equal(shiftsAreDisabled({ capabilities: { shiftsDisabled: 'true' as unknown as boolean } }), false);
});
