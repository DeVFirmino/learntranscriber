const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { onboardingProgress, shouldPresentOnboarding, hasUsefulSession, guideStep, GUIDE_STEPS } = loadTs(
  'src/features/onboarding/progress.ts',
);
const { previewSettings } = loadTs('src/bridge/mock/settings-fixture.ts');
function state() {
  return {
    settings: previewSettings(),
    credentials: {},
    localModels: { models: [], binaries: {} },
    chatgpt: { accounts: [], activeId: null },
    permissions: { microphone: 'not-determined', screen: 'not-determined' },
    sessions: [],
    privacy: { concealed: false },
    overlay: { listening: { active: false } },
    activeSessionId: null,
  };
}
test('first use welcomes; returning profiles resume at the first genuinely missing step', () => {
  const s = state();
  assert.equal(onboardingProgress(s).current, 'welcome');
  s.settings.onboardingStarted = true;
  assert.equal(onboardingProgress(s).current, 'insights');
  s.settings.customBaseUrl = 'http://localhost:8000/v1';
  assert.equal(onboardingProgress(s).current, 'audioSource');
  s.settings.onboardingAudioSource = 'microphone';
  assert.equal(onboardingProgress(s).current, 'permissions');
  s.permissions.microphone = 'granted';
  // A ready setup skips the sample conversation: the first real session takes its place.
  assert.equal(onboardingProgress(s).current, 'finish');
  s.settings.onboardingCompleted = true;
  assert.equal(onboardingProgress(s).completed, true);
  s.settings.customBaseUrl = '';
  assert.equal(onboardingProgress(s).current, 'insights');
  assert.equal(onboardingProgress(s).completed, false);
});
test('dismissal, built-in choices and completion flags do not invent readiness', () => {
  const s = state();
  s.settings.onboardingDismissed = true;
  s.settings.assistantsChosen = true;
  s.settings.onboardingDemoSeen = true;
  s.settings.onboardingCompleted = true;
  const progress = onboardingProgress(s);
  assert.equal(progress.configurationReady, false);
  assert.equal(progress.completed, false);
  assert.equal(progress.demoSeen, true);
  assert.equal(progress.firstUsefulSession, false);
  assert.equal(progress.next, 'insights');
  assert.equal(shouldPresentOnboarding(s), false);
});
test('automatic presentation never interrupts an active or starting session', () => {
  const s = state();
  assert.equal(shouldPresentOnboarding(s), true);
  s.activeSessionId = 'session';
  assert.equal(shouldPresentOnboarding(s), false);
  s.activeSessionId = null;
  s.overlay.listening.starting = true;
  assert.equal(shouldPresentOnboarding(s), false);
});
test('a useful session needs actual transcript and non-placeholder answer in that session', () => {
  const transcript = { session_id: 'a', kind: 'transcript', content: 'Can we try recall?' };
  const answer = { session_id: 'a', kind: 'assistant', content: 'Recall one idea before rereading.' };
  assert.equal(hasUsefulSession(), false);
  assert.equal(hasUsefulSession({ id: 'a', entries: [answer] }), false);
  assert.equal(hasUsefulSession({ id: 'a', entries: [transcript, { ...answer, content: 'Listening…' }] }), false);
  assert.equal(hasUsefulSession({ id: 'a', entries: [transcript, { ...answer, session_id: 'b' }] }), false);
  assert.equal(hasUsefulSession({ id: 'a', entries: [transcript, answer] }), true);
});

test('a profile updated with saved sessions sees the onboarding once, until it is closed or finished', () => {
  const s = state();
  s.sessions = [{ id: 'saved' }];
  assert.equal(shouldPresentOnboarding(s), true);
  s.settings.onboardingStarted = true;
  assert.equal(shouldPresentOnboarding(s), true);
  s.settings.onboardingDismissed = true;
  assert.equal(shouldPresentOnboarding(s), false);
  s.settings.onboardingDismissed = false;
  s.settings.onboardingCompleted = true;
  assert.equal(shouldPresentOnboarding(s), false);
});

test('concealed windows do not request an onboarding panel', () => {
  const s = state();
  s.privacy.concealed = true;
  assert.equal(shouldPresentOnboarding(s), false);
});

test('starting setup cannot advance past insights until the bridge confirms a key and selected model', () => {
  const s = state();
  s.settings.onboardingStarted = true;
  s.settings.provider = 'openai';
  s.settings.model = '';
  const current = () => onboardingProgress(s).current;
  assert.equal(current(), 'insights');
  s.settings.model = 'selected-model';
  assert.equal(current(), 'insights');
  s.settings.model = '';
  s.credentials.openai = true;
  assert.equal(current(), 'insights');
  s.settings.model = 'selected-model';
  assert.equal(current(), 'audioSource');
  delete s.credentials.openai;
  assert.equal(current(), 'insights');
});

test('the header counts five parts: welcome, AI, listening, permissions and the first try', () => {
  assert.equal(GUIDE_STEPS, 5);
  const parts = ['welcome', 'insights', 'transcription', 'audioSource', 'permissions', 'demo', 'finish'].map(guideStep);
  assert.deepEqual(parts, [1, 2, 3, 3, 4, 5, 5]);
});
