import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundNotes, MAX_NOTES } from '../src/lib/notes';

const some = (count: number) => Array.from({ length: count }, (_, i) => `Note ${i + 1}.`);

test('a few notes are all shown, in order', () => {
  assert.deepEqual(boundNotes([]), []);
  assert.deepEqual(boundNotes(some(1)), ['Note 1.']);
  assert.deepEqual(boundNotes(some(MAX_NOTES)), some(MAX_NOTES));
});

test('one more than the most is still shown whole: "and 1 more" would take the room of the note it hides', () => {
  assert.deepEqual(boundNotes(some(MAX_NOTES + 1)), some(MAX_NOTES + 1));
});

test('more than that is cut to the most, and the rest are counted', () => {
  assert.deepEqual(boundNotes(some(MAX_NOTES + 2)), [...some(MAX_NOTES), 'and 2 more.']);
  const many = boundNotes(some(40));
  assert.equal(many.length, MAX_NOTES + 1);
  assert.equal(many[MAX_NOTES], `and ${40 - MAX_NOTES} more.`);
});

test('what is shown is a new list: the one given is not changed', () => {
  const given = some(10);
  const before = [...given];
  boundNotes(given);
  assert.deepEqual(given, before);
  const small = some(2);
  assert.notEqual(boundNotes(small), small);
});

test('the most can be given', () => {
  assert.deepEqual(boundNotes(some(5), 1), ['Note 1.', 'and 4 more.']);
  assert.deepEqual(boundNotes(some(2), 1), ['Note 1.', 'Note 2.']);
});
