import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { describeQueuedSale } from '../src/lib/queued-sale-notice';

const setup = (requirement: string, hint?: string) => new ApiError('x', { status: 403, code: 'setup_required', requirement, ...(hint ? { hint } : {}) });
const server = (status: number) => new ApiError('whatever the server said', { status });

test('a sale that is saved is never told "try again": that would ring it up twice', () => {
  const errors = [
    setup('shift'),
    setup('till'),
    setup('branch'),
    setup('branch', 'assign'),
    setup('dispensing'),
    server(423),
    server(500),
    server(503),
    server(429),
    server(400),
    server(403),
    server(409),
    server(422),
    new TypeError('Network request failed'),
    new Error('anything'),
    null,
  ];
  for (const error of errors) {
    for (const context of [{}, { app: 'cashier' as const }, { app: 'cashier' as const, shiftsDisabled: true }, { app: 'grocery' as const }, { pairingEnabled: true }]) {
      const { title, body } = describeQueuedSale(error, context);
      assert.doesNotMatch(`${title} ${body}`, /try again/i, `${String(error)} ${JSON.stringify(context)}`);
      assert.match(body, /Do not ring it up again\.$/, 'ends with what not to do');
      assert.match(body, /saved on this phone, under Unsent sales|saved on this phone/i, 'says where the sale is');
      assert.ok(title.length > 0 && title.length < 60, title);
    }
  }
});

test('no shift open: the person is offered to open one, and told the sale goes on its own', () => {
  const notice = describeQueuedSale(setup('shift'), { app: 'cashier' });
  assert.equal(notice.title, 'Sale saved. Open a shift to send it');
  assert.equal(notice.action, 'open_shift');
  assert.match(notice.body, /sent on its own once a shift is open/);
});

test('a shift that cannot be opened here is not offered, and says where it is opened', () => {
  for (const context of [{ app: 'cashier' as const, shiftsDisabled: true }, { app: 'grocery' as const }, { app: 'stock' as const }]) {
    const notice = describeQueuedSale(setup('shift'), context);
    assert.equal(notice.action, undefined, JSON.stringify(context));
    assert.match(notice.body, /once a shift is open on the web/);
  }
  assert.equal(describeQueuedSale(setup('shift')).action, 'open_shift', 'with no app named the till is assumed');
});

test('a phone not approved as a till, a person with no branch and a sale with medicines each say their own step', () => {
  assert.match(describeQueuedSale(setup('till')).body, /manager has to approve this phone[\s\S]*Send now/);
  assert.match(describeQueuedSale(setup('branch', 'assign')).body, /put you on a branch[\s\S]*Send now/);
  assert.match(describeQueuedSale(setup('dispensing')).body, /finished on the web/);
  for (const requirement of ['till', 'branch', 'dispensing']) {
    assert.equal(describeQueuedSale(setup(requirement)).action, undefined, requirement);
  }
});

test('a switched-off shop, a busy server, a refusal and no connection each say what happened', () => {
  assert.equal(describeQueuedSale(server(423)).title, 'The shop is switched off');
  assert.match(describeQueuedSale(server(423)).body, /ask the owner to contact support/);
  for (const status of [500, 502, 503, 408, 429]) {
    assert.match(describeQueuedSale(server(status)).body, /couldn't take the sale just now[\s\S]*when the server is back/, String(status));
  }
  for (const status of [400, 401, 403, 404, 409, 422]) {
    assert.match(describeQueuedSale(server(status)).body, /did not accept this sale[\s\S]*ask your manager/i, String(status));
  }
  for (const offline of [new TypeError('Network request failed'), Object.assign(new Error('Aborted'), { name: 'AbortError' }), 'boom', undefined]) {
    const notice = describeQueuedSale(offline);
    assert.equal(notice.title, 'Saved offline');
    assert.match(notice.body, /^No connection\./);
  }
});

test('a setup answer the app does not know is treated as the server refusing the sale, not as a setup step', () => {
  const unknown = new ApiError('x', { status: 403, code: 'setup_required', requirement: 'moon' });
  assert.match(describeQueuedSale(unknown).body, /did not accept this sale/);
  const notSetup = new ApiError('x', { status: 403, code: 'something_else', requirement: 'shift' });
  assert.match(describeQueuedSale(notSetup).body, /did not accept this sale/);
});

test('nothing shown is a status number, a code or a placeholder', () => {
  for (const error of [setup('shift'), setup('till'), server(500), server(423), server(400), new TypeError('x')]) {
    const { title, body } = describeQueuedSale(error);
    assert.doesNotMatch(`${title} ${body}`, /\b[45]\d\d\b|setup_required|undefined|null|\[object/i, `${title} ${body}`);
  }
});
