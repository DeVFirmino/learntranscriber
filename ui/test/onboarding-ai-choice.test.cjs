const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const choice = loadTs('src/features/onboarding/ai-choice.ts');

test('the card that starts selected follows the saved provider, and a custom endpoint belongs to no card', () => {
  assert.equal(choice.initialAiChoice(''), 'chatgpt');
  assert.equal(choice.initialAiChoice('chatgpt'), 'chatgpt');
  assert.equal(choice.initialAiChoice('gemini'), 'key');
  assert.equal(choice.initialAiChoice('openrouter'), 'key');
  assert.equal(choice.initialAiChoice('local'), 'local');
  assert.equal(choice.providerChoice('custom'), null);
  assert.equal(choice.initialAiChoice('custom'), 'chatgpt');
});

test('a new connection answers with the first offered model in catalog order, else the first offered', () => {
  assert.equal(choice.firstModel(['gpt-4o', 'gpt-5.4'], ['gpt-5.4', 'gpt-4o']), 'gpt-5.4');
  assert.equal(choice.firstModel(['house-model'], ['gpt-5.4']), 'house-model');
  assert.equal(choice.firstModel([], ['gpt-5.4']), '');
});

test('the local download is the recommended current language model, sized with its projector', () => {
  const catalog = [
    { id: 'whisper', kind: 'whisper', recommended: true, bytes: 9 },
    { id: 'old', kind: 'llm', legacy: true, recommended: true, bytes: 1 },
    { id: 'small', kind: 'llm', bytes: 2 },
    { id: 'vision', kind: 'llm', recommended: true, bytes: 1_100_000_000, projector: { bytes: 400_000_000 } },
  ];
  const model = choice.recommendedLocalModel(catalog);
  assert.equal(model.id, 'vision');
  assert.equal(choice.downloadBytes(model), 1_500_000_000);
  assert.equal(choice.sizeLabel(1_500_000_000), '1.5 GB');
  assert.equal(choice.sizeLabel(491_400_032), '491 MB');
  assert.equal(choice.recommendedLocalModel(catalog.slice(0, 3)).id, 'small');
  assert.equal(choice.recommendedLocalModel([]), undefined);
});

test('download progress reads only the language-model operation and waits for a known size', () => {
  assert.equal(choice.localProgress({ operations: [] }), null);
  assert.equal(choice.localProgress({ operations: [{ kind: 'llm', bytes: 5, total: null }] }), null);
  assert.equal(choice.localProgress({ operations: [{ kind: 'whisper', bytes: 5, total: 10 }] }), null);
  assert.equal(choice.localProgress({ operations: [{ kind: 'llm', bytes: 333, total: 1000 }] }), 33);
  assert.equal(choice.localProgress({ operations: [{ kind: 'llm', bytes: 12, total: 10 }] }), 100);
});
