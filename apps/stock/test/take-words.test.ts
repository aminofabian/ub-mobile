import assert from 'node:assert/strict';
import test from 'node:test';
import { formatQty } from '@kiosk/core';
import { closeBlockedWords, differenceWords, FILTERS, heldWords, problemWords, signOutWords, typeFailureWords } from '../src/lib/take-words';
import type { CountProblem, RowFilter } from '../src/lib/stock-take';

test('every reason a count was not taken has words of its own', () => {
  const all: CountProblem[] = ['conflict', 'locked', 'closed', 'refused'];
  const words = all.map(problemWords);
  assert.equal(new Set(words).size, all.length);
  for (const line of words) assert.ok(line.length > 10 && line.endsWith('.') || line.endsWith('…'), line);
});

test('a count that cannot be typed says why', () => {
  assert.match(typeFailureWords('closed'), /closed/);
  assert.match(typeFailureWords('locked'), /manager/);
  assert.match(typeFailureWords('no_line'), /not in this stock take/);
  assert.match(typeFailureWords('held'), /someone else/);
});

test('counts held on a phone say whose they are and what happens to them', () => {
  assert.equal(heldWords('person', 3).title, 'Counts typed by someone else');
  assert.equal(heldWords('branch', 1).title, 'Counts for another branch');
  assert.match(heldWords('person', 1).short, /^1 count typed by someone else is waiting/);
  assert.match(heldWords('person', 2).short, /^2 counts typed by someone else are waiting/);
  assert.match(heldWords('branch', 2).short, /^2 counts typed for another branch are waiting/);
  assert.match(heldWords('person', 2).long, /signs in here again/);
  assert.match(heldWords('branch', 2).long, /signs in at that branch/);
});

test('signing out says the counts stay, and that only the person who typed them sends them', () => {
  assert.match(signOutWords(1), /^1 count is waiting/);
  assert.match(signOutWords(3), /^3 counts are waiting/);
  assert.match(signOutWords(3), /sign in again/);
  assert.match(signOutWords(3), /Nobody else can send them/);
});

test('closing is explained when it is not offered', () => {
  assert.match(closeBlockedWords('not_allowed'), /manager/);
  assert.match(closeBlockedWords('unsent'), /waiting to be sent/);
  assert.match(closeBlockedWords('not_open'), /already closed/);
});

test('every filter the logic knows is offered once, with a label', () => {
  const known: RowFilter[] = ['todo', 'counted', 'different', 'unsent', 'all'];
  assert.deepEqual(FILTERS.map((f) => f.key).sort(), [...known].sort());
  assert.equal(new Set(FILTERS.map((f) => f.label)).size, FILTERS.length);
});

test('a difference always shows its sign', () => {
  assert.equal(differenceWords(30000, formatQty), '+3');
  assert.equal(differenceWords(-20000, formatQty), '-2');
  assert.equal(differenceWords(0, formatQty), '0');
  assert.equal(differenceWords(5000, formatQty), '+0.5');
});
