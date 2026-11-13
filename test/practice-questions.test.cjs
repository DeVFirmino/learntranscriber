// Practice questions are a stored answer generated from the transcript, on the summary's model preset.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  generationMode,
  generationQuestion,
  needsTranscript,
  isDraft,
} = require('../src/main/domain/sessions/generation.cjs');
const { MODE_FEATURES } = require('../src/main/domain/providers/generation-presets.cjs');
const { persistGeneratedOutput } = require('../src/main/application/sessions/generated-output.cjs');

test('practice is a known mode that needs a transcript and is kept, not a draft', () => {
  assert.equal(generationMode({ mode: 'practice' }), 'practice');
  assert.equal(needsTranscript('practice'), true);
  assert.equal(isDraft('practice'), false);
  assert.equal(MODE_FEATURES.practice, 'tldr');
});

test('the request asks for at most five numbered questions, easiest first, then the answers, without invention', () => {
  const question = generationQuestion('practice', {}, {});
  assert.match(question, /five at most, numbered, from the easiest to the hardest/);
  assert.match(question, /"## Answers" section/);
  assert.match(question, /do not invent facts/);
});

test('the questions are saved as an assistant entry tagged with their mode', () => {
  const added = [];
  const entries = { add: (...args) => added.push(args) || { id: 'e1' } };
  persistGeneratedOutput({ sessions: {}, entries }, { id: 's1' }, 'practice', '1. What is a base case?', 'r1');
  assert.deepEqual(added, [
    ['s1', 'assistant', '1. What is a base case?', '', null, { mode: 'practice', requestId: 'r1' }],
  ]);
});
