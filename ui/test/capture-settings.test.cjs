// The audio settings choose where incoming audio is recorded and whether live captions run.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { helperRoute, liveCaptions, appleHearsHelper } = loadTs('src/audio/capture-settings.ts');

const settings = (extra) => ({ microphoneId: 'default', systemAudio: true, systemAudioSource: 'native', ...extra });

test('ScreenCaptureKit and the process tap are the native helper routes', () => {
  assert.equal(helperRoute('native'), true);
  assert.equal(helperRoute('process-tap'), true);
  assert.equal(helperRoute('input-device'), false);
  assert.equal(helperRoute('display'), false);
});

test('live captions run only when enabled for a streaming provider', () => {
  for (const provider of ['local', 'apple', 'openai', 'gemini'])
    assert.equal(liveCaptions(settings({ liveTranscription: true, transcriptionProvider: provider })), true);
  assert.equal(liveCaptions(settings({ liveTranscription: true, transcriptionProvider: 'openrouter' })), false);
  assert.equal(liveCaptions(settings({ liveTranscription: false, transcriptionProvider: 'apple' })), false);
  assert.equal(liveCaptions(settings({ liveTranscription: true })), false);
});

test('Apple Speech hears the helper audio itself only on a helper route with incoming audio on', () => {
  assert.equal(appleHearsHelper(settings({ transcriptionProvider: 'apple' })), true);
  assert.equal(appleHearsHelper(settings({ transcriptionProvider: 'apple', systemAudio: false })), false);
  assert.equal(
    appleHearsHelper(settings({ transcriptionProvider: 'apple', systemAudioSource: 'input-device' })),
    false,
  );
  assert.equal(appleHearsHelper(settings({ transcriptionProvider: 'openai' })), false);
});
