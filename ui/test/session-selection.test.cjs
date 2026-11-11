const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { selectionScope, toggleSessionSelection, visibleSessionSelection } = loadTs(
  'src/features/sessions/session-selection.ts',
);

test('selection is immutable and only includes visible sessions in the same page and search scope', () => {
  const scope = selectionScope(0, '', false);
  const original = { scope, ids: new Set() };
  const picked = toggleSessionSelection(original, 's1');
  assert.equal(original.ids.size, 0);
  assert.deepEqual([...visibleSessionSelection(picked, scope, [{ id: 's1' }, { id: 's2' }])], ['s1']);
  assert.equal(visibleSessionSelection(picked, scope, [{ id: 's2' }]).size, 0);
  for (const other of [selectionScope(1, '', false), selectionScope(0, 'new', false), selectionScope(0, '', true)])
    assert.equal(visibleSessionSelection(picked, other, [{ id: 's1' }]).size, 0);
  assert.equal(toggleSessionSelection(picked, 's1').ids.size, 0);
});
