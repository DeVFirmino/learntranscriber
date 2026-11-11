// An AI source counts as connected when it can be used now: models downloaded, a local server's port, Apple Speech
// authorized, a signed-in ChatGPT account, a saved key, or a complete custom endpoint.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { connectedSources, activeChatGPT } = loadTs('src/settings/tabs/ai-sources/connected-sources.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

const state = (overrides = {}) => ({
  settings: { customBaseUrl: '', model: '', provider: 'openai', ...overrides.settings },
  localModels: { models: overrides.models || [] },
  credentials: overrides.credentials || {},
  chatgpt: overrides.chatgpt || { accounts: [], activeId: null },
});

test('a fresh profile has nothing connected', () => {
  assert.deepEqual(plain(connectedSources(state(), false)), {
    local: false,
    ollama: false,
    lmstudio: false,
    apple_speech: false,
    chatgpt: false,
    openai: false,
    gemini: false,
    openrouter: false,
    custom: false,
  });
});

test('local servers are recognised by their port, and a custom endpoint needs a model and the custom provider', () => {
  const ollama = connectedSources(state({ settings: { customBaseUrl: 'http://127.0.0.1:11434/v1' } }), false);
  assert.equal(ollama.ollama, true);
  assert.equal(ollama.custom, false);
  const custom = state({ settings: { customBaseUrl: 'http://127.0.0.1:1234/v1', model: 'qwen', provider: 'custom' } });
  assert.equal(connectedSources(custom, false).lmstudio, true);
  assert.equal(connectedSources(custom, false).custom, true);
});

test('keys, downloaded models, Apple Speech and only the active signed-in ChatGPT account count', () => {
  const ready = state({
    models: [{ id: 'base' }],
    credentials: { openai: true, gemini: false, openrouter: true },
    chatgpt: {
      accounts: [
        { id: 'a', authenticated: false },
        { id: 'b', authenticated: true },
      ],
      activeId: 'b',
    },
  });
  const connected = connectedSources(ready, true);
  assert.equal(connected.local, true);
  assert.equal(connected.apple_speech, true);
  assert.equal(connected.openai, true);
  assert.equal(connected.gemini, false);
  assert.equal(connected.openrouter, true);
  assert.equal(activeChatGPT(ready).id, 'b');
  assert.equal(
    activeChatGPT(state({ chatgpt: { accounts: [{ id: 'a', authenticated: false }], activeId: 'a' } })),
    undefined,
  );
});
