const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const choices = loadTs('src/features/onboarding/listening-choices.ts');
const { previewSettings } = loadTs('src/bridge/mock/settings-fixture.ts');

const settings = (patch = {}) => ({ ...previewSettings(), ...patch });
// Values built inside the loaded modules come from another VM context; compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

test('picking browser or meeting audio turns incoming audio on; the microphone choice turns it off', () => {
  assert.deepEqual(plain(choices.audioSourcePatch('computer')), {
    onboardingAudioSource: 'computer',
    systemAudio: true,
  });
  assert.deepEqual(plain(choices.audioSourcePatch('microphone')), {
    onboardingAudioSource: 'microphone',
    systemAudio: false,
  });
});

test('each choice asks only for the macOS access it needs', () => {
  const needs = (patch) => plain(choices.permissionNeeds(settings(patch)));
  assert.deepEqual(needs({ onboardingAudioSource: 'microphone', transcriptionProvider: 'openai' }), ['microphone']);
  assert.deepEqual(needs({ onboardingAudioSource: 'microphone', transcriptionProvider: 'apple' }), [
    'microphone',
    'speech',
  ]);
  assert.deepEqual(
    needs({
      onboardingAudioSource: 'computer',
      systemAudio: true,
      systemAudioSource: 'native',
      transcriptionProvider: 'gemini',
    }),
    ['microphone', 'screen'],
  );
  assert.deepEqual(
    needs({
      onboardingAudioSource: 'computer',
      systemAudio: true,
      systemAudioSource: 'input-device',
      transcriptionProvider: 'gemini',
    }),
    ['microphone'],
  );
  assert.deepEqual(needs({ onboardingAudioSource: 'computer', systemAudio: false, transcriptionProvider: 'openai' }), [
    'microphone',
  ]);
  assert.deepEqual(needs({ onboardingAudioSource: '', transcriptionProvider: 'apple' }), ['speech']);
});

test('grants come from macOS state, and speech only from an authorized Apple Speech status', () => {
  const state = { permissions: { microphone: 'granted', screen: 'denied' } };
  assert.deepEqual(plain(choices.permissionGrants(state, 'authorized')), {
    microphone: true,
    screen: false,
    speech: true,
  });
  assert.deepEqual(plain(choices.permissionGrants(state, 'not-determined')), {
    microphone: true,
    screen: false,
    speech: false,
  });
});

test('an API transcription engine without its key is reported; Apple Speech needs none', () => {
  const missing = (provider, credentials = {}) =>
    choices.transcriptionKeyMissing({ settings: settings({ transcriptionProvider: provider }), credentials });
  assert.equal(missing('openai'), true);
  assert.equal(missing('openai', { openai: true }), false);
  assert.equal(missing('gemini'), true);
  assert.equal(missing('apple'), false);
});

test('switching from computer to microphone disables the incoming capture route', () => {
  const { incomingChoice } = loadTs('src/audio/incoming-choice.ts');
  const selected = settings({ ...choices.audioSourcePatch('computer'), ...choices.audioSourcePatch('microphone') });
  assert.equal(selected.systemAudio, false);
  assert.equal(incomingChoice(selected), 'none');
  assert.deepEqual(plain(choices.permissionNeeds(selected)), ['microphone']);
});

test('permission needs still account for incoming audio enabled outside the onboarding choice', () => {
  assert.deepEqual(
    plain(
      choices.permissionNeeds(
        settings({
          onboardingAudioSource: 'microphone',
          systemAudio: true,
          systemAudioSource: 'native',
          transcriptionProvider: 'openai',
        }),
      ),
    ),
    ['microphone', 'screen'],
  );
});
