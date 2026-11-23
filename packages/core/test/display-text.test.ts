import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDisplayText, MAX_DISPLAY_NAME_LENGTH, plainHost } from '../src/display-text';

test('a plain host is kept in lower case, and anything else is not a host', () => {
  assert.equal(plainHost('acme.kiosk.ke'), 'acme.kiosk.ke');
  assert.equal(plainHost('  Acme.Kiosk.KE '), 'acme.kiosk.ke');
  assert.equal(plainHost('shop-1.example.co.ke:8443'), 'shop-1.example.co.ke:8443');
  for (const bad of ['', '  ', 'localhost', 'acme', '-acme.ke', 'acme-.ke', 'ac me.ke', 'acme.ke/path', 'acme.ke?x=1', 'https://acme.ke', 'user@acme.ke', 'acme.ke:99999999', 'acme..ke', 'acme.ke\nx.ke']) {
    assert.equal(plainHost(bad), null, JSON.stringify(bad));
  }
  assert.equal(plainHost(`${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`), `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`, '253 characters is the longest');
  assert.equal(plainHost(`${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`), null, '254 is too long');
  assert.equal(plainHost(`${'a'.repeat(64)}.ke`), null, 'a label longer than 63');
  assert.equal(plainHost(42), null);
  assert.equal(plainHost(null), null);
  assert.equal(plainHost(undefined), null);
});

test('a name keeps its words and loses stray spaces and line breaks', () => {
  assert.equal(cleanDisplayText('  Acme \n\t Mart  '), 'Acme Mart');
  assert.equal(cleanDisplayText('Acme\u00A0Mart'), 'Acme Mart');
  assert.equal(cleanDisplayText(''), '');
  assert.equal(cleanDisplayText('   '), '');
});

test('marks that hide or reorder text are removed, and the spaces they leave are closed up', () => {
  assert.equal(cleanDisplayText('Acme \u202Etrams\u202C'), 'Acme trams');
  assert.equal(cleanDisplayText('Ac\u200Bme'), 'Acme');
  assert.equal(cleanDisplayText('A\u2066b\u2069c\u2060d'), 'Abcd');
  assert.equal(cleanDisplayText('A\u200Eb\u200Fc\u00ADd\u061Ce'), 'Abcde');
  assert.equal(cleanDisplayText('A\u0000b\u007Fc\u009Fd'), 'Abcd');
  assert.equal(cleanDisplayText('Acme \u202E Mart'), 'Acme Mart');
});

test('tag characters and variation selectors that can carry hidden text are removed', () => {
  const tags = String.fromCodePoint(0xe0049, 0xe0067, 0xe006e, 0xe007f);
  assert.equal(cleanDisplayText(`Acme${tags} Mart`), 'Acme Mart');
  assert.equal(cleanDisplayText(`${tags}`), '');
  assert.equal(cleanDisplayText(`A${String.fromCodePoint(0xe0100)}b${String.fromCodePoint(0xe01ef)}c`), 'Abc');
  assert.equal(cleanDisplayText('A\uFE00b\uFE01c\uFE0Dd'), 'Abcd');
  // The edges of the ranges: one before and one after are other characters, and are kept.
  assert.equal(cleanDisplayText(`A${String.fromCodePoint(0xe0080)}`), `A${String.fromCodePoint(0xe0080)}`, 'U+E0080 is not a tag character');
  assert.equal(cleanDisplayText(`A${String.fromCodePoint(0xe01f0)}`), `A${String.fromCodePoint(0xe01f0)}`, 'U+E01F0 is not a selector');
  assert.equal(cleanDisplayText(`A${String.fromCodePoint(0xe00ff)}`), `A${String.fromCodePoint(0xe00ff)}`, 'U+E00FF is between the two ranges');
  assert.equal(cleanDisplayText('A\uFDFFb'), 'A\uFDFFb');
  assert.equal(cleanDisplayText('A\uFE10b'), 'A\uFE10b', 'U+FE10 is vertical punctuation, not a selector');
});

test('filler characters that draw nothing leave a name blank, and are removed from the middle of one', () => {
  for (const filler of ['\u115F', '\u1160', '\u17B4', '\u17B5', '\u2800', '\u3164', '\uFFA0']) {
    assert.equal(cleanDisplayText(filler.repeat(5)), '', `U+${filler.charCodeAt(0).toString(16).toUpperCase()} alone is a blank name`);
    assert.equal(cleanDisplayText(`Ac${filler}me`), 'Acme');
  }
  assert.equal(cleanDisplayText('\u3164 \u2800 '), '');
});

test('the choice between text and emoji style survives, so a heart is still a heart', () => {
  assert.equal(cleanDisplayText('❤\uFE0F Shop'), '❤\uFE0F Shop');
  assert.equal(cleanDisplayText('☺\uFE0E Shop'), '☺\uFE0E Shop');
  assert.equal(cleanDisplayText('1\uFE0F\u20E3 Stop'), '1\uFE0F\u20E3 Stop', 'a keycap sequence');
});

test('what other scripts and emoji need is kept', () => {
  const persian = 'می\u200Cخواهم'; // a zero-width non-joiner inside a word
  assert.equal(cleanDisplayText(persian), persian);
  const family = '👨\u200D👩\u200D👧 Shop';
  assert.equal(cleanDisplayText(family), family);
  assert.equal(cleanDisplayText('Café Müller – 北京'), 'Café Müller – 北京');
});

test('the length is counted in characters, so an emoji is never cut in half', () => {
  const name = 'a'.repeat(MAX_DISPLAY_NAME_LENGTH - 1) + '😀' + 'tail';
  const cleaned = cleanDisplayText(name);
  assert.equal(Array.from(cleaned).length, MAX_DISPLAY_NAME_LENGTH);
  assert.ok(cleaned.endsWith('😀'));
  assert.doesNotThrow(() => encodeURIComponent(cleaned), 'no half of a pair is left');
  assert.equal(cleanDisplayText('x'.repeat(500), 10), 'x'.repeat(10));
});

test('anything that is not text is nothing', () => {
  for (const junk of [null, undefined, 42, {}, [], true]) {
    assert.equal(cleanDisplayText(junk), '');
  }
});
