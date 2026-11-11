const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { submitsQuestion } = loadTs('src/features/overlay/question-key.ts');

test('Enter submits, while Shift+Enter and composition confirmation preserve the draft', () => {
  const enter = { key: 'Enter', shiftKey: false, composing: false };
  assert.equal(submitsQuestion(enter), true);
  assert.equal(submitsQuestion({ ...enter, shiftKey: true }), false);
  assert.equal(submitsQuestion({ ...enter, composing: true }), false);
  assert.equal(submitsQuestion({ ...enter, keyCode: 229 }), false);
  assert.equal(submitsQuestion({ ...enter, key: 'a' }), false);
});
