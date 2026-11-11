const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { customServer } = loadTs('src/settings/model-groups/cards.ts');
const { analysisGroups } = loadTs('src/settings/model-groups/analysis-groups.ts');
const { transcriptionGroups } = loadTs('src/settings/model-groups/transcription-groups.ts');

const plain = (value) => JSON.parse(JSON.stringify(value));
const st = (key, fallback, values) =>
  typeof fallback === 'string' ? fallback : `${key}${fallback || values ? JSON.stringify(fallback || values) : ''}`;
const settings = {
  provider: 'openai',
  model: 'gpt-5.6-sol',
  translationProvider: '',
  translationModel: '',
  transcriptionProvider: 'openai',
  transcriptionModel: 'gpt-4o-transcribe',
  customBaseUrl: '',
};
const setup = (over = {}) => ({
  settings,
  signedIn: false,
  keys: {},
  available: {},
  localLlm: [],
  localWhisper: [],
  platform: 'darwin',
  st,
  ...over,
});

test('a custom base URL is recognized as Ollama or LM Studio by its port', () => {
  assert.deepEqual(plain(customServer('http://127.0.0.1:11434/v1')), { name: 'Ollama', icon: 'ollama', local: true });
  assert.deepEqual(plain(customServer('http://localhost:1234')), { name: 'LM Studio', icon: 'lmstudio', local: true });
  assert.deepEqual(plain(customServer('https://api.example.com')), { name: null, icon: 'custom', local: false });
});

test('transcription lists OpenAI, Gemini, Apple Speech on a Mac and local Whisper, in that order', () => {
  const groups = transcriptionGroups(
    setup({ keys: { openai: true, gemini: true }, localWhisper: [{ id: 'w1', name: 'Whisper tiny' }] }),
  );
  assert.deepEqual(plain(groups.map((group) => group.id)), [
    'openai-transcription',
    'gemini-transcription',
    'apple-transcription',
    'local-transcription',
  ]);
  assert.equal(groups[0].description, 'Loading available models...');
  assert.equal(transcriptionGroups(setup({ platform: 'linux' })).length, 0);
  const local = groups[3];
  assert.equal(local.selected(local.models[0]), false);
  assert.equal(local.local(local.models[0]), 'w1');
});

test('OpenAI marks the models the account lacks and says how many the usage tier locks', () => {
  const [openai] = transcriptionGroups(setup({ keys: { openai: true }, available: { openai: ['gpt-4o-transcribe'] } }));
  const locked = openai.models.filter((model) => model.unavailable).length;
  assert.ok(locked > 0);
  assert.equal(openai.tierHint, true);
  assert.equal(openai.description, `settings.models.unavailableCount${JSON.stringify({ count: locked })}`);
  assert.equal(openai.selected(openai.models.find((model) => model.id === 'gpt-4o-transcribe')), true);
  assert.deepEqual(plain(openai.choose({ id: 'gpt-4o-transcribe' })), {
    transcriptionProvider: 'openai',
    transcriptionModel: 'gpt-4o-transcribe',
  });
});

test('analysis lists each configured provider and saves the analysis provider and model', () => {
  const groups = analysisGroups(
    setup({
      signedIn: true,
      keys: { openai: true, gemini: true, openrouter: true },
      settings: { ...settings, customBaseUrl: 'http://127.0.0.1:11434/v1' },
      localLlm: [{ id: 'l1', name: 'Qwen' }],
    }),
    'analysis',
  );
  assert.deepEqual(plain(groups.map((group) => group.id)), [
    'codex-analysis',
    'openai-analysis',
    'gemini-analysis',
    'openrouter-analysis',
    'custom-analysis',
    'local-analysis',
  ]);
  const custom = groups[4];
  assert.equal(custom.title, 'Ollama');
  assert.equal(custom.description, 'Models available on your Ollama server.');
  assert.deepEqual(plain(groups[2].choose({ id: 'gemini-x' })), { provider: 'gemini', model: 'gemini-x' });
  assert.deepEqual(plain(groups[5].choose({ id: 'l1' })), { provider: 'local' });
});

test('translation follows the analysis choice until it has its own provider, and OpenRouter keeps its model', () => {
  const routed = { ...settings, provider: 'openrouter', model: 'anthropic/claude' };
  const [openrouter] = analysisGroups(setup({ keys: { openrouter: true }, settings: routed }), 'translation');
  assert.equal(openrouter.selected(openrouter.models[0]), true);
  assert.deepEqual(plain(openrouter.choose(openrouter.models[0])), {
    translationProvider: 'openrouter',
    translationModel: 'anthropic/claude',
  });
  assert.equal(openrouter.models[0].description, 'anthropic/claude');
  const own = { ...routed, translationProvider: 'gemini', translationModel: 'gemini-y' };
  const [gemini] = analysisGroups(setup({ keys: { gemini: true }, settings: own }), 'translation');
  assert.equal(gemini.selected({ id: 'gemini-y' }), true);
  assert.equal(gemini.badge, 'API Key');
});

test('a key OpenAI refused locks every OpenAI card and says why', () => {
  const reason = 'OpenAI rejected the credentials (HTTP 401). Update the API key or sign in again in AI sources.';
  const over = { keys: { openai: true }, available: { openai: [] }, rejected: { openai: reason } };
  const openai = analysisGroups(setup(over), 'analysis').find((group) => group.id === 'openai-analysis');
  assert.equal(openai.description, reason);
  assert.ok(openai.models.length > 0);
  assert.ok(
    openai.models.every((model) => model.unavailable && model.note === 'Unavailable until OpenAI accepts the API key.'),
  );
  assert.equal(openai.tierHint, false);
  const [transcription] = transcriptionGroups(setup(over));
  assert.ok(transcription.models.every((model) => model.unavailable));
  const listed = analysisGroups(setup({ keys: { openai: true }, available: { openai: [] } }), 'analysis');
  assert.ok(listed.find((group) => group.id === 'openai-analysis').models.every((model) => !model.unavailable));
});
