const { test } = require('node:test');
const assert = require('node:assert/strict');
const { suggestionSource, suggestionMessages } = require('../src/main/domain/sessions/follow-up-suggestions.cjs');
const {
  translatableEntry,
  translationTarget,
  translationText,
} = require('../src/main/domain/sessions/entry-translation.cjs');

const long = 'An answer long enough to suggest follow-up questions about it.';
const session = {
  entries: [
    { id: 'a1', kind: 'assistant', content: long },
    { id: 't1', kind: 'transcript', speaker: 'THEY', content: 'Hola' },
    { id: 't2', kind: 'transcript', speaker: 'ME', content: 'Hi' },
    { id: 'a2', kind: 'assistant', content: long + ' Later.' },
  ],
};

test('suggestions use the latest answer, or any saved answer when historical', () => {
  assert.equal(suggestionSource(session, 'a2', false).id, 'a2');
  assert.throws(() => suggestionSource(session, 'a1', false), /latest assistant answer/);
  assert.equal(suggestionSource(session, 'a1', true).id, 'a1');
  assert.throws(() => suggestionSource(session, 't1', true), /saved assistant answer/);
});

test('a long answer keeps its start and end in the suggestion prompt', () => {
  const [, user] = suggestionMessages('Be brief.', 'a'.repeat(12000) + 'b'.repeat(13000));
  assert.match(user.content, /^a{12000}\n\[Middle omitted for length\]\nb{12000}$/);
});

test('only participant transcript messages translate, into a named language, with a usable reply', () => {
  assert.equal(translatableEntry(session, 't1').content, 'Hola');
  assert.throws(() => translatableEntry(session, 't2'), /participant transcript/);
  assert.equal(translationTarget('  Portuguese '), 'Portuguese');
  assert.throws(() => translationTarget(' '), /translation language/);
  assert.equal(translationText(' Olá '), 'Olá');
  assert.throws(() => translationText(''), /no usable translation/);
});
