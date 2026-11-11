const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { connectChatGPT, connectKey, connectLocal } = loadTs('src/features/onboarding/ai-connect.ts');

function fakeApi({ offered = {}, runtime = {}, download = {} } = {}) {
  const calls = [];
  return {
    calls,
    loginChatGPT: async () => calls.push(['login']),
    models: async (provider) => {
      calls.push(['models', provider]);
      return offered[provider] ?? [];
    },
    saveKey: async (input) => calls.push(['key', input]),
    settings: async (patch) => calls.push(['settings', patch]),
    installRuntime: async (kind) => {
      calls.push(['runtime', kind]);
      return runtime;
    },
    downloadCatalog: async (id) => {
      calls.push(['download', id]);
      return download;
    },
  };
}

test('ChatGPT signs in only when no account is active, then answers with its first catalog model', async () => {
  const api = fakeApi({ offered: { chatgpt: ['gpt-4o', 'gpt-5.4'] } });
  await connectChatGPT(api, false);
  assert.deepEqual(JSON.parse(JSON.stringify(api.calls)), [
    ['login'],
    ['models', 'chatgpt'],
    ['settings', { provider: 'chatgpt', model: 'gpt-5.4' }],
  ]);
  const signedIn = fakeApi({ offered: { chatgpt: ['gpt-4o'] } });
  await connectChatGPT(signedIn, true);
  assert.deepEqual(signedIn.calls[0], ['models', 'chatgpt']);
});

test('a key is saved trimmed and proved by listing models before the provider is chosen', async () => {
  const api = fakeApi({ offered: { openrouter: ['anthropic/x', 'openai/gpt-4o-mini'] } });
  await connectKey(api, 'openrouter', '  sk-or  ');
  assert.deepEqual(JSON.parse(JSON.stringify(api.calls)), [
    ['key', { provider: 'openrouter', key: 'sk-or' }],
    ['models', 'openrouter'],
    ['settings', { provider: 'openrouter', model: 'openai/gpt-4o-mini' }],
  ]);
});

test('a provider that lists no models leaves the AI unchosen', async () => {
  const api = fakeApi();
  await assert.rejects(connectKey(api, 'openai', 'sk'), /no models/);
  assert.equal(
    api.calls.some(([name]) => name === 'settings'),
    false,
  );
});

test('the local card installs and downloads only what this Mac lacks', async () => {
  const catalog = [{ id: 'qwen', kind: 'llm', recommended: true }];
  const ready = { binaries: { llm: '/bin/llama' }, models: [{ id: 'uuid-1', kind: 'llm', available: true }] };
  const already = fakeApi();
  await connectLocal(already, ready, catalog);
  assert.deepEqual(JSON.parse(JSON.stringify(already.calls)), [['settings', { provider: 'local', model: 'uuid-1' }]]);

  const fresh = fakeApi({ runtime: { binaries: { llm: '/bin/llama' }, models: [] }, download: ready });
  await connectLocal(fresh, { binaries: {}, models: [] }, catalog);
  assert.deepEqual(JSON.parse(JSON.stringify(fresh.calls)), [
    ['runtime', 'llm'],
    ['download', 'qwen'],
    ['settings', { provider: 'local', model: 'uuid-1' }],
  ]);
});

test('a download that ends without a usable model never marks the local AI as chosen', async () => {
  const api = fakeApi({ download: { binaries: { llm: 'x' }, models: [] } });
  await assert.rejects(
    connectLocal(api, { binaries: { llm: 'x' }, models: [] }, [{ id: 'qwen', kind: 'llm' }]),
    /did not finish/,
  );
  await assert.rejects(connectLocal(fakeApi(), { binaries: { llm: 'x' }, models: [] }, []), /No local model/);
});
