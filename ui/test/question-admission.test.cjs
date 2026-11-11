const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { canSendQuestion } = loadTs('src/features/overlay/question-admission.ts');

test('a typed question can start a session instead of requiring one before sending', () => {
  assert.equal(canSendQuestion({ question: ' What next? ', hasImages: false, busy: false, ready: true }), true);
});

test('empty questions need an attachment and requests wait for readiness and completion', () => {
  const input = { question: ' \n ', hasImages: false, busy: false, ready: true };
  assert.equal(canSendQuestion(input), false);
  assert.equal(canSendQuestion({ ...input, hasImages: true }), true);
  assert.equal(canSendQuestion({ ...input, question: 'Next?', busy: true }), false);
  assert.equal(canSendQuestion({ ...input, hasImages: true, ready: false }), false);
});
