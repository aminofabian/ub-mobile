import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommonActions, StackActions, StackRouter } from '@react-navigation/routers';

/**
 * The till is one screen that stays open under the screens that are opened from it (payment, receipt, a new product).
 * Going back to it has to bring that same screen forward. `navigate` does not do that: it puts a second copy of the till
 * on top, with an empty search and a fresh read of the price list, and the one underneath stays behind it. These tests
 * run the real router, so a change in how the library behaves is seen here and not by a cashier.
 */

const NAMES = ['Shift', 'Pos', 'Payment', 'Receipt', 'NewProduct', 'WebOrders', 'Conflicts'];
const router = StackRouter({});
const config = { routeNames: NAMES, routeParamList: {}, routeGetIdList: {}, routeKeyChanges: [] };

type Route = { name: string; params?: unknown };
type State = { routes: Route[]; index: number };

function stackOf(...names: string[]): State {
  return router.getRehydratedState({ routes: names.map((name) => ({ name })) } as never, config as never) as unknown as State;
}

function apply(state: State, action: unknown): State {
  const next = router.getStateForAction(state as never, action as never, config as never);
  assert.ok(next, 'the router took the action');
  return next as unknown as State;
}

const names = (state: State) => state.routes.map((route) => route.name);

test('navigate puts a second till on top of the first: the reason the screens above it do not use it to go back', () => {
  const next = apply(stackOf('Shift', 'Pos', 'Payment'), CommonActions.navigate('Pos'));
  assert.deepEqual(names(next), ['Shift', 'Pos', 'Payment', 'Pos']);
});

test('popTo brings the till that is already open forward, and hands it what to do', () => {
  const next = apply(stackOf('Shift', 'Pos', 'Payment'), StackActions.popTo('Pos', { reload: true }));
  assert.deepEqual(names(next), ['Shift', 'Pos']);
  assert.equal(next.index, 1);
  assert.deepEqual(next.routes[1].params, { reload: true });
});

test('it does the same from the receipt that follows a payment', () => {
  const next = apply(stackOf('Shift', 'Pos', 'Receipt'), StackActions.popTo('Pos', { reload: true }));
  assert.deepEqual(names(next), ['Shift', 'Pos']);
});

test('it does the same from a new product, with a notice and a search for the till to run', () => {
  const next = apply(
    stackOf('Shift', 'Pos', 'NewProduct'),
    StackActions.popTo('Pos', { notice: 'Added Bread.', search: 'Bread' })
  );
  assert.deepEqual(names(next), ['Shift', 'Pos']);
  assert.deepEqual(next.routes[1].params, { notice: 'Added Bread.', search: 'Bread' });
});

test('a sale that needs a shift takes the person back to the shift screen that is already open', () => {
  const next = apply(stackOf('Shift', 'Pos', 'Payment'), StackActions.popTo('Shift'));
  assert.deepEqual(names(next), ['Shift']);
});

test('popTo from the till itself leaves the stack as it is', () => {
  const next = apply(stackOf('Shift', 'Pos'), StackActions.popTo('Pos', { reload: true }));
  assert.deepEqual(names(next), ['Shift', 'Pos']);
});

// What the screens actually call. The router behaviour above is only worth something if they use popTo.
const screens = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/screens');
const read = (file: string) => fs.readFileSync(path.join(screens, file), 'utf8');

test('the screens opened from the till go back to it with popTo, never with navigate', () => {
  for (const file of fs.readdirSync(screens).filter((name) => name.endsWith('.tsx') && name !== 'ShiftScreen.tsx')) {
    assert.doesNotMatch(read(file), /navigate\(\s*'Pos'/, `${file} must not open a second till`);
  }
  for (const file of ['PaymentScreen.tsx', 'ReceiptScreen.tsx', 'NewProductScreen.tsx']) {
    assert.match(read(file), /popTo\(\s*'Pos'/, `${file} goes back to the till with popTo`);
  }
});
