const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { modelSetup } = loadTs('src/features/model-setup.ts');
function state(provider = 'chatgpt', model = 'selected') {
  return {
    settings: { provider, model, customBaseUrl: '' },
    chatgpt: { accounts: [], activeId: null },
    credentials: {},
    localModels: { binaries: {}, models: [] },
  };
}
test('authenticated active accounts still need a selected model', () => {
  const s = state();
  assert.equal(modelSetup(s), 'connect');
  s.chatgpt.accounts.push({ id: 'a', authenticated: true });
  assert.equal(modelSetup(s), 'provider');
  s.chatgpt.activeId = 'a';
  assert.equal(modelSetup(s), 'ready');
  s.settings.model = '  ';
  assert.equal(modelSetup(s), 'model');
  s.chatgpt.accounts[0].authenticated = false;
  assert.equal(modelSetup(s), 'connect');
});
test('another connected provider does not authorize the selected provider', () => {
  const s = state('openai');
  s.chatgpt.accounts.push({ id: 'a', authenticated: true });
  assert.equal(modelSetup(s), 'provider');
  s.credentials.openai = true;
  assert.equal(modelSetup(s), 'ready');
  s.settings.model = '';
  assert.equal(modelSetup(s), 'model');
});
test('local setup requires a binary, available model and selection', () => {
  const s = state('local');
  assert.equal(modelSetup(s), 'local');
  s.localModels.binaries.llm = '/fixture';
  assert.equal(modelSetup(s), 'local');
  s.localModels.models.push({ kind: 'llm', available: true });
  assert.equal(modelSetup(s), 'ready');
  s.settings.model = '';
  assert.equal(modelSetup(s), 'model');
});
test('custom endpoint and credentials do not replace a model choice', () => {
  const s = state('custom', '');
  assert.equal(modelSetup(s), 'connect');
  s.settings.customBaseUrl = 'http://fixture';
  assert.equal(modelSetup(s), 'model');
  s.settings.model = 'selected';
  assert.equal(modelSetup(s), 'ready');
});

test('shared model readiness rejects missing state and reports a provider-neutral setup error', () => {
  const { modelReady, requireModelReady } = loadTs('src/features/model-setup.ts');
  for (const value of [null, undefined, state('openai')]) {
    assert.equal(modelReady(value), false);
    assert.throws(() => requireModelReady(value), /Connect an AI provider and choose a model/);
  }
  const s = state('openai');
  s.credentials.openai = true;
  assert.equal(modelReady(s), true);
  assert.doesNotThrow(() => requireModelReady(s));
  s.settings.model = ' ';
  assert.equal(modelReady(s), false);
});
