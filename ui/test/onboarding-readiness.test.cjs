const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { onboardingReadiness } = loadTs('src/features/onboarding/readiness.ts');
const { previewSettings } = loadTs('src/bridge/mock/settings-fixture.ts');
function state() {
  return {
    settings: { ...previewSettings(), provider: 'openai', model: 'chosen', transcriptionProvider: 'openai' },
    credentials: { openai: true },
    localModels: { models: [], binaries: {} },
    chatgpt: { accounts: [], activeId: null },
    permissions: { microphone: 'granted', screen: 'granted' },
  };
}
test('insights credentials do not configure transcription or choose an audio source', () => {
  const s = state();
  s.settings.transcriptionProvider = 'gemini';
  const ready = onboardingReadiness(s);
  assert.equal(ready.insights, true);
  assert.equal(ready.transcription, false);
  assert.equal(ready.audioSource, false);
  assert.equal(ready.permissions, false);
});
test('ChatGPT needs a confirmed authenticated account and selected model', () => {
  const s = state();
  s.settings.provider = 'chatgpt';
  s.chatgpt.activeId = 'a';
  assert.equal(onboardingReadiness(s).insights, false);
  s.chatgpt.accounts = [{ id: 'a', authenticated: false }];
  assert.equal(onboardingReadiness(s).insights, false);
  s.chatgpt.accounts[0].authenticated = true;
  assert.equal(onboardingReadiness(s).insights, true);
  s.settings.model = '';
  assert.equal(onboardingReadiness(s).insights, false);
});
test('local and custom providers need their actual assets or endpoint', () => {
  const s = state();
  s.settings.provider = 'local';
  s.settings.transcriptionProvider = 'local';
  assert.equal(onboardingReadiness(s).insights, false);
  s.localModels.models = [
    { kind: 'llm', available: true },
    { kind: 'whisper', available: true },
  ];
  assert.equal(onboardingReadiness(s).transcription, false);
  s.localModels.binaries = { llm: '/llm', whisper: '/whisper' };
  assert.equal(onboardingReadiness(s).insights, true);
  assert.equal(onboardingReadiness(s).transcription, true);
  s.settings.provider = 'custom';
  s.settings.customBaseUrl = '';
  assert.equal(onboardingReadiness(s).insights, false);
  s.settings.customBaseUrl = 'http://localhost:8000/v1';
  assert.equal(onboardingReadiness(s).insights, true);
});
test('computer audio is not selected by granting screen permission alone', () => {
  const s = state();
  s.settings.onboardingAudioSource = 'computer';
  assert.equal(onboardingReadiness(s).audioSource, false);
  s.settings.systemAudio = true;
  assert.equal(onboardingReadiness(s).permissions, true);
  s.permissions.screen = 'denied';
  assert.equal(onboardingReadiness(s).permissions, false);
  s.settings.systemAudioSource = 'input-device';
  assert.equal(onboardingReadiness(s).audioSource, false);
  s.settings.systemAudioInputDevice = 'loopback';
  assert.equal(onboardingReadiness(s).permissions, true);
});
test('Apple Speech requires confirmed authorization, independently of microphone access', () => {
  const s = state();
  s.settings.onboardingAudioSource = 'microphone';
  s.settings.transcriptionProvider = 'apple';
  assert.equal(onboardingReadiness(s).transcription, true);
  for (const speechAuthorization of [undefined, 'denied', 'restricted', 'not-determined'])
    assert.equal(onboardingReadiness(s, { speechAuthorization }).permissions, false);
  assert.equal(onboardingReadiness(s, { speechAuthorization: 'authorized' }).permissions, true);
  s.permissions.microphone = 'denied';
  assert.equal(onboardingReadiness(s, { speechAuthorization: 'authorized' }).permissions, false);
});

test('computer audio cannot be ready without the microphone the recording pipeline opens', () => {
  const s = state();
  s.settings.onboardingAudioSource = 'computer';
  s.settings.systemAudio = true;
  s.permissions.microphone = 'denied';
  assert.equal(onboardingReadiness(s).permissions, false);
  s.permissions.microphone = 'granted';
  assert.equal(onboardingReadiness(s).permissions, true);
});
