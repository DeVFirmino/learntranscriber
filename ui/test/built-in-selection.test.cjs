const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const { initialBuiltInSelection, toggleSelection, canSaveSelection } = loadTs(
  'src/features/assistants/built-in-selection.ts',
);

const catalog = [
  { id: 'general', name: 'General Assistant', category: 'General' },
  { id: 'math', name: 'Math Assistant', category: 'Education' },
];
const state = (assistantsChosen, ids) => ({
  settings: { assistantsChosen },
  builtInAssistants: catalog,
  assistants: ids.map((id) => ({ id, name: id, prompt: 'x' })),
});

test('every built-in starts checked before the first choice, then only the ones kept', () => {
  assert.deepEqual([...initialBuiltInSelection(state(false, ['general']))], ['general', 'math']);
  assert.deepEqual([...initialBuiltInSelection(state(true, ['math', 'mine']))], ['math']);
});

test('toggling adds or removes one id', () => {
  assert.deepEqual([...toggleSelection(['general'], 'math')], ['general', 'math']);
  assert.deepEqual([...toggleSelection(['general', 'math'], 'general')], ['math']);
});

test('an empty choice is saved only when the user has assistants of their own', () => {
  assert.equal(canSaveSelection(state(true, ['general']), []), false);
  assert.equal(canSaveSelection(state(true, ['general', 'mine']), []), true);
  assert.equal(canSaveSelection(state(true, ['general']), ['general']), true);
});
