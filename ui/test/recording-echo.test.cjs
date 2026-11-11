// The microphone is echo-cancelled against the incoming audio only while echo reduction is on and incoming audio is
// recorded; the worklet block size follows the setting.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { RecordingEcho } = loadTs('src/audio/recording-echo.ts');

function reduction(enabled = true) {
  const calls = [];
  return {
    calls,
    echo: {
      enabled,
      setEnabled(value) {
        this.enabled = value;
      },
      capture: () => ({
        prepare: async () => calls.push('prepare'),
        resetCapture: () => calls.push('reset'),
        release: () => calls.push('mic released'),
        processFloat32: (samples) => (calls.push('processed'), samples.map(() => 0.5)),
      }),
      reference: () => ({
        analyzePCM16: () => calls.push('reference'),
        release: () => calls.push('reference released'),
      }),
    },
  };
}

test('the block size is the small one only while echo reduction is on', () => {
  const { echo } = reduction(false);
  const recording = new RecordingEcho(echo);
  assert.equal(recording.blockSize, 4096);
  assert.equal(recording.setEnabled(true), true);
  assert.equal(recording.blockSize, 512);
  assert.equal(recording.setEnabled(true), false, 'an unchanged setting does not resize the worklets');
  assert.equal(new RecordingEcho().blockSize, 4096);
});

test('incoming blocks are the reference and microphone blocks come out processed', () => {
  const { echo, calls } = reduction();
  const recording = new RecordingEcho(echo);
  recording.start({ systemAudio: true });
  const incoming = new Int16Array([1, 2]);
  assert.equal(recording.block('THEY', incoming, 16000), incoming);
  assert.deepEqual([...recording.block('ME', new Int16Array([1, 2]), 16000)], [16384, 16384]);
  assert.deepEqual(calls, ['reference', 'processed']);
});

test('without incoming audio or with echo reduction off the microphone is recorded as is', () => {
  const { echo, calls } = reduction();
  const recording = new RecordingEcho(echo);
  recording.start({ systemAudio: false, echoReductionEnabled: false });
  const mic = new Int16Array([1, 2]);
  assert.equal(recording.block('ME', mic, 16000), mic);
  recording.block('THEY', new Int16Array([1]), 16000);
  assert.deepEqual(calls, []);
});

test('following the incoming setting creates and releases the reference, and stopping releases both sides', () => {
  const { echo, calls } = reduction();
  const recording = new RecordingEcho(echo);
  recording.start({ systemAudio: false });
  recording.follow({ systemAudio: true });
  recording.analyzeIncoming(new Int16Array([1]), 16000);
  recording.follow({ systemAudio: false });
  recording.analyzeIncoming(new Int16Array([1]), 16000);
  recording.stop();
  assert.deepEqual(calls, ['reference', 'reference released', 'reset', 'mic released']);
});
