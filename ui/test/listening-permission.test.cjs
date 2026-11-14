const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { missingListeningPermission } = loadTs('src/features/workspace/listening-permission.ts');

test('the native helper permission is checked even if the app reports granted Screen Recording', async () => {
  const state = {
    settings: {
      onboardingAudioSource: 'computer',
      systemAudio: true,
      systemAudioSource: 'native',
      transcriptionProvider: 'openai',
    },
    permissions: { microphone: 'granted', screen: 'granted' },
  };
  assert.equal(
    await missingListeningPermission({ systemAudioStatus: async () => ({ permissionGranted: false }) }, state),
    'screen',
  );
  assert.equal(
    await missingListeningPermission({ systemAudioStatus: async () => ({ permissionGranted: true }) }, state),
    undefined,
  );
});
