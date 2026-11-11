const { test } = require('node:test');
const assert = require('node:assert/strict');
const { wav, wavSamples, packetWav } = require('../src/main/domain/audio/wav.cjs');

const pcm = Buffer.from([1, 0, 2, 0, 3, 0, 4, 0]);

test('a WAV segment round-trips to its PCM samples', () => {
  const bytes = wav(pcm);
  assert.equal(bytes.length, 44 + pcm.length);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.deepEqual(Buffer.from(wavSamples(Uint8Array.from(bytes).buffer)), pcm);
});

test('odd, oversized or foreign audio is refused', () => {
  assert.throws(() => wav(Buffer.from([1])), /Invalid native audio segment/);
  assert.throws(() => wav(Buffer.alloc(600000)), /Invalid native audio segment/);
  assert.equal(wav(Buffer.alloc(600000), 600000).length, 600044);
  const truncated = Uint8Array.from(wav(pcm)).buffer.slice(0, 50);
  assert.throws(() => wavSamples(truncated), /Invalid native audio packet/);
  assert.throws(() => wavSamples(new ArrayBuffer(10)), /Invalid native audio packet/);
});

test('a helper packet must be base64 PCM', () => {
  assert.deepEqual(packetWav(pcm.toString('base64')), wav(pcm));
  assert.throws(() => packetWav(''), /Invalid audio encoding/);
  assert.throws(() => packetWav('not base64!'), /Invalid audio encoding/);
});
