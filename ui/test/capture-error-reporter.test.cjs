const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { createCaptureErrorReporter } = loadTs('src/features/workspace/capture-error-reporter.ts');

function harness({
  microphone = 'granted',
  screen = 'granted',
  helper = true,
  speech = 'authorized',
  settings = {},
} = {}) {
  const shown = [];
  const api = {
    state: async () => ({
      permissions: { microphone, screen },
      settings: {
        onboardingAudioSource: 'computer',
        systemAudio: true,
        systemAudioSource: 'native',
        transcriptionProvider: 'apple',
        ...settings,
      },
    }),
    speechCapabilities: async () => ({ authorization: speech }),
    systemAudioStatus: async () => ({ permissionGranted: helper }),
  };
  const report = createCaptureErrorReporter({
    api,
    blocked: (permission, diagnostic) => shown.push(['permission', permission, diagnostic]),
    failure: (message) => shown.push(['error', message]),
  });
  return { api, report, shown };
}

test('the screenshot denial gives one Screen & System Audio permission hint, including when only the helper lacks access', async () => {
  const diagnostic =
    'Native system audio could not start (The user declined TCCs for application, window, display capture).';
  for (const input of [{ screen: 'denied' }, { helper: false }]) {
    const h = harness(input);
    await h.report(diagnostic);
    assert.deepEqual(h.shown, [['permission', 'screen', diagnostic]]);
  }
});

test('microphone and speech denial use the existing onboarding permission order', async () => {
  for (const [input, permission] of [
    [{ microphone: 'denied', screen: 'denied' }, 'microphone'],
    [{ speech: 'denied' }, 'speech'],
  ]) {
    const h = harness(input);
    await h.report('Capture refused');
    assert.deepEqual(h.shown, [['permission', permission, 'Capture refused']]);
  }
});

test('a runtime failure with all permissions granted keeps its real diagnostic', async () => {
  const h = harness();
  await h.report('The helper stopped');
  assert.deepEqual(h.shown, [['error', 'The helper stopped']]);
});

test('loopback and API transcription do not ask for unused macOS permissions', async () => {
  const h = harness({
    screen: 'denied',
    helper: false,
    speech: 'denied',
    settings: { systemAudioSource: 'input-device', transcriptionProvider: 'openai' },
  });
  h.api.systemAudioStatus = () => assert.fail('Loopback must not check native screen permission');
  h.api.speechCapabilities = () => assert.fail('API transcription must not check Apple Speech');
  await h.report('Loopback disconnected');
  assert.deepEqual(h.shown, [['error', 'Loopback disconnected']]);
});

test('an unavailable permission check does not replace the diagnostic with a guessed denial', async () => {
  const h = harness();
  h.api.state = async () => {
    throw new Error('Unavailable');
  };
  await h.report('Original capture error');
  assert.deepEqual(h.shown, [['error', 'Original capture error']]);
});
