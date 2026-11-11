const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { providerKeyUrl } = loadTs('src/features/provider-key-url.ts');

test('key actions select the official provider destination and reject unknown names', () => {
  assert.equal(providerKeyUrl('openai'), 'https://platform.openai.com/api-keys');
  assert.equal(providerKeyUrl('gemini'), 'https://aistudio.google.com/apikey');
  assert.equal(providerKeyUrl('openrouter'), 'https://openrouter.ai/keys');
  for (const name of ['apple', 'local', 'unknown', 'constructor', '__proto__'])
    assert.equal(providerKeyUrl(name), undefined);
});
