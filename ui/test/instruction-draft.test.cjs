const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { draftQuestion, canonicalCategory } = loadTs('src/features/dialogs/assistant/instruction-draft.ts');

test('the draft request names the assistant and category only when they are filled', () => {
  assert.equal(
    draftQuestion({ name: ' Sales coach ', category: 'Career', brief: ' Review my pitch. ' }),
    'Write the system instructions for an assistant named "Sales coach" in the "Career" category. What it should do: Review my pitch.',
  );
  assert.equal(
    draftQuestion({ name: '', category: 'Uncategorized', brief: 'Take notes' }),
    'Write the system instructions for an assistant. What it should do: Take notes',
  );
});

test('a typed category reuses the existing spelling and collapses spaces', () => {
  const existing = ['General', 'Study notes'];
  assert.equal(canonicalCategory(' general ', existing), 'General');
  assert.equal(canonicalCategory('study   NOTES', existing), 'Study notes');
  assert.equal(canonicalCategory('  Career ', existing), 'Career');
  assert.equal(canonicalCategory('', existing), '');
});
