// An assistant opens with the builder's draft, else its saved fields, else the defaults; a knowledge file joins
// only within the limits and with readable text.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { initialFields, fileProblem, contentProblem } = loadTs('src/features/dialogs/assistant/assistant-fields.ts');

test('the draft wins over the saved assistant, which wins over the defaults', () => {
  const saved = { id: 'a', name: 'A', prompt: 'p', category: 'Work', follow_up_prompt: 'saved follow-up' };
  const fromDraft = initialFields({ category: 'Study', followUpPrompt: '', requireCertainty: true }, saved);
  assert.equal(fromDraft.category, 'Study');
  assert.equal(fromDraft.followUpPrompt, 'saved follow-up');
  assert.equal(fromDraft.requireCertainty, true);
  const fresh = initialFields(undefined, undefined, 'Sales');
  assert.equal(fresh.category, 'Sales');
  assert.equal(initialFields(undefined, undefined).category, 'Uncategorized');
  assert.equal(fresh.requireCertainty, false);
});

test('a picked file needs room among twenty, at most 1 MB, and a plain name', () => {
  assert.equal(fileProblem({ name: 'notes.md', size: 10 }, 0), null);
  assert.equal(fileProblem({ name: 'notes.md', size: 10 }, 20), 'assistantDialog.limit');
  assert.equal(fileProblem({ name: 'notes.md', size: 1_000_001 }, 0), 'assistantDialog.limit');
  assert.equal(fileProblem({ name: 'empty.md', size: 0 }, 0), 'assistantDialog.limit');
  assert.equal(fileProblem({ name: 'two\nlines.md', size: 10 }, 0), 'assistantDialog.invalidName');
  assert.equal(fileProblem({ name: '   ', size: 10 }, 0), 'assistantDialog.invalidName');
});

test('binary text or more than 200,000 characters in all cannot join the knowledge', () => {
  assert.equal(contentProblem('plain text', []), null);
  assert.equal(contentProblem('bin\u0000ary', []), 'assistantDialog.unreadable');
  assert.equal(
    contentProblem('x', [{ name: 'a', size: 1, content: 'y'.repeat(200_000) }]),
    'assistantDialog.unreadable',
  );
});
