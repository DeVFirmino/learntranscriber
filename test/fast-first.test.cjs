const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fastFirstSettings, fastFirstModel } = require('../src/main/domain/sessions/fast-first.cjs');
const { generationSettings, generationQuestion } = require('../src/main/domain/sessions/generation.cjs');
const { compatibleOptions, geminiOptions } = require('../src/main/domain/providers/generation-presets.cjs');

const base = (provider, model) => ({ provider, model, translationProvider: '' });

test('fast first models: OpenAI mini, Gemini Flash-Lite, no swap elsewhere', () => {
  assert.equal(fastFirstModel('openai'), 'gpt-5.4-mini');
  assert.equal(fastFirstModel('gemini'), 'gemini-3.1-flash-lite');
  for (const provider of ['chatgpt', 'openrouter', 'custom', 'local']) assert.equal(fastFirstModel(provider), '');
  const kept = { provider: 'chatgpt', model: 'gpt-5.6-terra', generationConfig: { maxOutputTokens: 1500 } };
  assert.equal(fastFirstSettings(kept), kept);
});

test('only the baseline screen read uses the fast first configuration', () => {
  const settings = base('openai', 'gpt-5.6-terra');
  const baseline = generationSettings('screenInsight', settings, {}, { baseline: true });
  assert.equal(baseline.model, 'gpt-5.4-mini');
  assert.equal(baseline.fastFirstFallbackModel, 'gpt-5.6-terra');
  assert.equal(baseline.generationConfig.maxOutputTokens, 420);
  assert.equal(baseline.generationConfig.reasoningEffort, 'none');
  assert.equal(baseline.generationConfig.temperature, undefined);
  for (const [mode, input] of [
    ['screenInsight', {}],
    ['insight', { baseline: true }],
    ['chat', { baseline: true }],
  ])
    assert.equal(generationSettings(mode, settings, {}, input).model, 'gpt-5.6-terra');
  assert.match(generationQuestion('screenInsight', { baseline: true }, settings), /^Read the current screen/);
  assert.match(generationQuestion('screenInsight', {}, settings), /^Explain the selected text/);
});

test('the baseline limits reach the provider request: 420 tokens and no temperature', () => {
  const openai = generationSettings('screenInsight', base('openai', 'gpt-4o'), {}, { baseline: true });
  assert.deepEqual(compatibleOptions(openai), { max_completion_tokens: 420 });
  const gemini = generationSettings('screenInsight', base('gemini', 'gemini-3.1-pro-preview'), {}, { baseline: true });
  assert.equal(gemini.model, 'gemini-3.1-flash-lite');
  const options = geminiOptions(gemini);
  assert.equal(options.maxOutputTokens, 420);
  assert.equal(options.temperature, undefined);
});
