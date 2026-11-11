const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { finishOnboarding } = loadTs('src/features/onboarding/handoff.ts');
const { onboardingProgress } = loadTs('src/features/onboarding/progress.ts');
const { previewSettings } = loadTs('src/bridge/mock/settings-fixture.ts');

function harness() {
  const state = {
    settings: {
      ...previewSettings(),
      provider: 'openai',
      model: 'selected-model',
      transcriptionProvider: 'openai',
      onboardingStarted: true,
      onboardingAudioSource: 'microphone',
      onboardingDemoSeen: true,
    },
    credentials: { openai: true },
    localModels: { models: [], binaries: {} },
    chatgpt: { accounts: [], activeId: null },
    permissions: { microphone: 'granted', screen: 'granted' },
    sessions: [],
    activeSessionId: null,
  };
  const calls = [];
  const api = {
    state: async () => state,
    speechCapabilities: async () => ({ authorization: 'authorized' }),
    settings: async (patch) => {
      Object.assign(state.settings, patch);
      calls.push(['settings', patch]);
    },
    expandOverlay: async (value) => calls.push(['panel', value]),
    showOverlay: async () => calls.push(['show']),
    presentOnboarding: async (active) => calls.push(['onboarding', active]),
  };
  return { api, state, calls };
}

test('handoff confirms the current configuration, completes and turns on the first-session guide, then shows without starting a session', async () => {
  for (const floating of [false, true]) {
    const { api, state, calls } = harness();
    await finishOnboarding({ api, floating });
    assert.equal(state.settings.onboardingCompleted, true);
    assert.equal(state.settings.onboardingDismissed, true);
    assert.equal(state.settings.onboardingGuide, true);
    assert.equal(state.sessions.length, 0);
    assert.equal(state.activeSessionId, null);
    assert.equal(onboardingProgress(state).firstUsefulSession, false);
    assert.equal(calls[0][0], 'settings');
    assert.deepEqual(
      calls.slice(1),
      floating ? [['onboarding', false], ['panel', false], ['show']] : [['onboarding', false], ['show']],
    );
  }
});

test('a seen example with missing or revoked setup opens the bar but leaves the real missing step accessible', async () => {
  for (const missing of ['key', 'source', 'permission']) {
    const { api, state } = harness();
    if (missing === 'key') delete state.credentials.openai;
    if (missing === 'source') state.settings.onboardingAudioSource = '';
    if (missing === 'permission') state.permissions.microphone = 'denied';
    await finishOnboarding({ api, floating: false });
    assert.equal(state.settings.onboardingCompleted, false, missing);
    assert.equal(state.settings.onboardingGuide, false, missing);
    assert.equal(onboardingProgress(state).completed, false, missing);
    assert.notEqual(onboardingProgress(state).current, 'finish', missing);
  }
});

test('unknown or denied Apple authorization never completes the onboarding', async () => {
  for (const authorization of ['denied', 'not-determined', undefined]) {
    const { api, state } = harness();
    state.settings.transcriptionProvider = 'apple';
    api.speechCapabilities = async () => {
      if (authorization === undefined) throw Error('Unavailable');
      return { authorization };
    };
    await finishOnboarding({ api, floating: false });
    assert.equal(state.settings.onboardingCompleted, false);
  }
});

test('a failed milestone save never opens or collapses the floating surfaces', async () => {
  const { api, calls } = harness();
  api.settings = async () => {
    throw Error('Save failed');
  };
  await assert.rejects(finishOnboarding({ api, floating: true }), /Save failed/);
  assert.deepEqual(calls, []);
});

test('computer audio with screen access alone cannot mark onboarding complete', async () => {
  const { api, state } = harness();
  Object.assign(state.settings, { onboardingAudioSource: 'computer', systemAudio: true, systemAudioSource: 'native' });
  state.permissions.microphone = 'denied';
  await finishOnboarding({ api, floating: false });
  assert.equal(state.settings.onboardingDemoSeen, true);
  assert.equal(state.settings.onboardingCompleted, false);
  assert.equal(onboardingProgress(state).current, 'permissions');
});

test('a ready setup completes without the sample conversation, since the first real session replaces it', async () => {
  const { api, state } = harness();
  state.settings.onboardingDemoSeen = false;
  await finishOnboarding({ api, floating: true });
  assert.equal(state.settings.onboardingCompleted, true);
  assert.equal(state.settings.onboardingGuide, true);
  assert.equal(onboardingProgress(state).completed, true);
});
