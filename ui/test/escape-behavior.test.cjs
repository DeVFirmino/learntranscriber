const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { escapeBehavior } = loadTs('src/features/overlay/escape-behavior.ts');
test('Escape closes the sheet, then the panel, before hiding the recording bar', () => {
  const state = { pinned: true, expanded: true, editing: true };
  assert.equal(escapeBehavior(state), 'shortcuts');
  assert.equal(escapeBehavior({ ...state, pinned: false }), 'panel');
  assert.equal(escapeBehavior({ ...state, pinned: false, expanded: false }), 'blur');
  assert.equal(escapeBehavior({ pinned: false, expanded: false, editing: false }), 'bar');
});
