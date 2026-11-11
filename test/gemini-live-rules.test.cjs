const { test } = require('node:test');
const assert = require('node:assert/strict');
const { liveSetup, fatalClose, validFrame, PAUSE_MS } = require('../src/main/domain/audio/gemini-live.cjs');

test('a Live session asks for input transcription only, with the server ending a turn after the pause', () => {
  const native = liveSetup('gemini-2.5-flash-native-audio-preview-12-2025').setup;
  assert.equal(native.model, 'models/gemini-2.5-flash-native-audio-preview-12-2025');
  assert.deepEqual(native.generationConfig.responseModalities, ['AUDIO']);
  assert.deepEqual(native.inputAudioTranscription, {});
  assert.deepEqual(native.realtimeInputConfig.automaticActivityDetection, {
    disabled: false,
    silenceDurationMs: PAUSE_MS,
  });
  assert.deepEqual(liveSetup('gemini-live-text').setup.generationConfig.responseModalities, ['TEXT']);
});

test('only configuration errors end a Live session without reconnecting', () => {
  assert.equal(fatalClose('models/x is not found for API version v1beta'), true);
  assert.equal(fatalClose('Cannot extract voices from a non-audio request'), true);
  assert.equal(fatalClose('Deadline expired before operation could complete.'), false);
  assert.equal(fatalClose(''), false);
});

test('audio frames are even-length PCM up to two seconds from the user or the other side', () => {
  const frame = (bytes, speaker = 'ME') => ({ speaker, samples: new ArrayBuffer(bytes) });
  assert.equal(validFrame(frame(3200)), true);
  assert.equal(validFrame(frame(64000, 'THEY')), true);
  assert.equal(validFrame(frame(64002)), false);
  assert.equal(validFrame(frame(3201)), false);
  assert.equal(validFrame(frame(0)), false);
  assert.equal(validFrame(frame(3200, 'SOMEONE')), false);
  assert.equal(validFrame({ speaker: 'ME', samples: new Uint8Array(4) }), false);
  assert.equal(validFrame(undefined), false);
});
