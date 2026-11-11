const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { promptPreview } = loadTs('src/features/assistants/prompt-preview.ts');

test('the compact preview uses instruction text while the original prompt stays intact', () => {
  const prompt =
    '# System Prompt\n\n## Purpose\n<ROLE>\nHelp the reader plan.\n</ROLE>\nKeep a < b comparisons unchanged.';
  assert.equal(promptPreview(prompt), 'Help the reader plan. Keep a < b comparisons unchanged.');
  assert.ok(prompt.includes('<ROLE>'));
});

test('heading-only and empty prompts still have an honest preview', () => {
  assert.equal(promptPreview('# Respond in Spanish'), 'Respond in Spanish');
  assert.equal(promptPreview('  \n\t'), '');
  assert.equal(promptPreview('  Keep it concise.\r\nAsk when uncertain. '), 'Keep it concise. Ask when uncertain.');
});
