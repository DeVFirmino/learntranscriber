const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { questionPresentation } = loadTs('src/features/overlay/question-presentation.ts');

test('asking stays compact until an answer arrives or the panel is closed and reopened', () => {
  assert.equal(questionPresentation({ asking: true, expanded: true, answerArrived: false }), true);
  assert.equal(questionPresentation({ asking: true, expanded: true, answerArrived: true }), false);
  assert.equal(questionPresentation({ asking: true, expanded: false, answerArrived: false }), false);
  assert.equal(questionPresentation({ asking: false, expanded: true, answerArrived: false }), false);
});
