const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { vocabularyEdit, VOCABULARY_LIMIT } = loadTs('src/features/settings/vocabulary.ts');

test('trims surrounding whitespace before saving', () => {
  assert.equal(vocabularyEdit('  Kubernetes, PostgreSQL  ', ''), 'Kubernetes, PostgreSQL');
});

test('returns null when the trimmed text already matches what is saved', () => {
  assert.equal(vocabularyEdit('Kubernetes', 'Kubernetes'), null);
  assert.equal(vocabularyEdit('  Kubernetes  ', 'Kubernetes'), null);
  assert.equal(vocabularyEdit('', ''), null);
});

test('caps the saved text at the validator limit', () => {
  const next = vocabularyEdit('x'.repeat(VOCABULARY_LIMIT + 10), '');
  assert.equal(next.length, VOCABULARY_LIMIT);
});
