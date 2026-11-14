const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SUMMARY_QUESTION } = require('../src/main/domain/sessions/summary-prompt.cjs');
const { PRESETS, MODE_FEATURES } = require('../src/main/domain/providers/generation-presets.cjs');

test('the summary asks for detailed notes shaped to a class, an interview or a meeting', () => {
  for (const pattern of [/detailed notes/, /class or lecture/i, /Interview:/, /Meeting or call:/, /never add anything/])
    assert.match(SUMMARY_QUESTION, pattern);
  assert.doesNotMatch(SUMMARY_QUESTION, /sections for overview, decisions, open questions and next steps/);
});

test('summaries and their rewrites get room for long notes', () => {
  assert.equal(MODE_FEATURES.summary, 'summary');
  assert.equal(MODE_FEATURES.summaryRewrite, 'summary');
  assert.ok(PRESETS.summary.maxOutputTokens >= 8000);
  assert.ok(PRESETS.summary.maxOutputTokens > PRESETS.tldr.maxOutputTokens);
});
