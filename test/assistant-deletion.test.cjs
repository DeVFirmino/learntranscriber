const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectionAfterDelete } = require('../src/main/domain/assistants/deletion.cjs');

test('the selection moves only when the deleted assistant was selected, preferring the general assistant', () => {
  assert.equal(selectionAfterDelete({ remainingIds: ['general', 'math'], selectedId: 'math', deletedId: 'x' }), 'math');
  assert.equal(selectionAfterDelete({ remainingIds: ['math', 'general'], selectedId: 'x', deletedId: 'x' }), 'general');
  assert.equal(selectionAfterDelete({ remainingIds: ['math', 'english'], selectedId: 'x', deletedId: 'x' }), 'math');
});

test('the last assistant cannot be deleted', () => {
  assert.throws(
    () => selectionAfterDelete({ remainingIds: [], selectedId: 'x', deletedId: 'x' }),
    /Keep at least one assistant/,
  );
});
