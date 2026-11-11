const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  contextSize,
  completionOptions,
  promptBudget,
  ContextWindowError,
} = require('../src/main/domain/providers/context-budget.cjs');

const managed = { managedLocal: true, contextSize: 4096 };

test('the prompt budget reserves the response and a safety margin from the context', () => {
  assert.deepEqual(promptBudget(managed, 3000), {
    contextSize: 4096,
    promptTokens: 3000,
    outputTokens: 512,
    safetyTokens: 128,
    inputTokens: 3456,
  });
  assert.equal(promptBudget(managed, 3456).inputTokens, 3456);
});

test('a prompt beyond the input budget fails with the measured budget', () => {
  assert.throws(
    () => promptBudget(managed, 3457),
    (error) =>
      error instanceof ContextWindowError &&
      error.code === 'CONTEXT_WINDOW_EXCEEDED' &&
      error.budget.promptTokens === 3457,
  );
});

test('the response reservation follows the voice, configured and context limits', () => {
  assert.equal(completionOptions({ ...managed, localVoice: true }).max_tokens, 384);
  assert.equal(completionOptions({ ...managed, generationConfig: { maxOutputTokens: 200 } }).max_tokens, 200);
  assert.equal(completionOptions({ managedLocal: true, contextSize: 1024 }).max_tokens, 256);
  assert.deepEqual(completionOptions({}), {});
  assert.equal(contextSize(), 4096);
  assert.throws(() => contextSize(511), /512 to 131,072/);
});
