import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serverWords } from '../src/lib/server-words';

test('words are kept, on one line', () => {
  assert.equal(serverWords('Out of stock: Milk'), 'Out of stock: Milk');
  assert.equal(serverWords('  Line one\n\nline   two\t! '), 'Line one line two !');
});

test('a web page is not words', () => {
  assert.equal(serverWords('<html><body>403 Forbidden</body></html>'), '');
  assert.equal(serverWords('  \n<!DOCTYPE html>'), '');
});

test('what is too long is cut, and what is not text is nothing', () => {
  assert.equal(serverWords('a'.repeat(500)).length, 200);
  assert.equal(serverWords('a'.repeat(500), 20).length, 20);
  for (const nothing of [undefined, null, 7, {}, '', '   ']) assert.equal(serverWords(nothing), '');
});
