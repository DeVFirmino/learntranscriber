const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { setupReadiness } = loadTs('src/features/setup-readiness.ts');
function state(extra = {}) {
  return {
    settings: {
      provider: 'openai',
      model: 'chosen',
      customBaseUrl: '',
      transcriptionProvider: 'openai',
      assistantId: 'general',
      assistantsChosen: true,
    },
    credentials: {},
    localModels: { models: [], binaries: {} },
    chatgpt: { activeId: null, accounts: [] },
    permissions: { microphone: 'denied' },
    assistants: [{ id: 'general', prompt: 'Ground replies in the session.' }],
    ...extra,
  };
}
test('onboarding never marks a cloud model or audio configured without its key and microphone permission', () => {
  const s = state();
  assert.equal(setupReadiness(s).model, false);
  assert.equal(setupReadiness(s).audio, false);
  s.credentials.openai = true;
  assert.equal(setupReadiness(s).model, true);
  assert.equal(setupReadiness(s).audio, false);
  s.permissions.microphone = 'granted';
  assert.equal(setupReadiness(s).audio, true);
  s.settings.model = ' ';
  assert.equal(setupReadiness(s).model, false);
});
test('local onboarding needs available model files and binaries rather than a saved model name', () => {
  const s = state();
  s.settings.provider = 'local';
  s.settings.transcriptionProvider = 'local';
  s.permissions.microphone = 'granted';
  s.localModels.models = [
    { kind: 'llm', available: true },
    { kind: 'whisper', available: false },
  ];
  assert.equal(setupReadiness(s).model, false);
  s.localModels.binaries.llm = '/fixture/llama';
  assert.equal(setupReadiness(s).model, true);
  assert.equal(setupReadiness(s).audio, false);
  s.localModels.binaries.whisper = '/fixture/whisper';
  s.localModels.models[1].available = true;
  assert.equal(setupReadiness(s).audio, true);
});
test('custom sources ChatGPT and assistant selection use their own configuration boundaries', () => {
  const s = state();
  s.settings.provider = 'custom';
  s.settings.transcriptionProvider = 'custom';
  s.permissions.microphone = 'granted';
  assert.equal(setupReadiness(s).model, false);
  assert.equal(setupReadiness(s).audio, false);
  s.settings.customBaseUrl = 'http://127.0.0.1:1234/v1';
  s.settings.transcriptionBaseUrl = 'http://127.0.0.1:1235/v1';
  s.settings.transcriptionModel = 'whisper';
  assert.equal(setupReadiness(s).model, true);
  assert.equal(setupReadiness(s).audio, true);
  s.settings.provider = 'chatgpt';
  assert.equal(setupReadiness(s).model, false);
  s.chatgpt.activeId = 'account';
  assert.equal(setupReadiness(s).model, false);
  s.chatgpt.accounts.push({ id: 'account', authenticated: true });
  assert.equal(setupReadiness(s).model, true);
  s.settings.model = '';
  assert.equal(setupReadiness(s).model, false);
  s.settings.assistantId = 'deleted';
  assert.equal(setupReadiness(s).assistant, false);
});
test('the assistant step waits for the built-in choice, then needs the selected assistant to have a prompt', () => {
  const s = state();
  s.settings.assistantsChosen = false;
  assert.equal(setupReadiness(s).assistant, false);
  s.settings.assistantsChosen = true;
  assert.equal(setupReadiness(s).assistant, true);
  s.settings.assistantId = 'gone';
  assert.equal(setupReadiness(s).assistant, false);
});
