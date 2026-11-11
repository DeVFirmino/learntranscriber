const { test } = require('node:test');
const assert = require('node:assert/strict');
const { providerFailure } = require('../src/main/infrastructure/providers/provider-failure.cjs');

test('a rejected request names the provider and the change that fixes its status', () => {
  assert.match(providerFailure(401, 'openai'), /^OpenAI rejected the credentials \(HTTP 401\)\. .*AI sources/);
  assert.match(providerFailure(403, 'gemini'), /^Gemini rejected the credentials/);
  assert.match(providerFailure(404, 'custom'), /^The custom endpoint could not find the model/);
  assert.match(providerFailure(429, 'openrouter'), /^OpenRouter is limiting requests or out of quota/);
  assert.equal(
    providerFailure(500, undefined),
    'The provider returned HTTP 500. Check the model and endpoint in AI sources.',
  );
});
