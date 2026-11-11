// The native helper's incoming audio is held by a lease when the window supports one, and released on every path.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { NativeSystemAudio } = loadTs('src/audio/native-system-audio.ts', { Promise, Error });

test('a lease is taken for the session and released when switching sources', async () => {
  const calls = [],
    messages = [];
  let during;
  const native = new NativeSystemAudio(
    {
      acquireSystemAudio: async (lease, id) => {
        calls.push(['acquire', lease, id]);
        return { fellBack: true, reason: 'Needs macOS 14.2.' };
      },
      releaseSystemAudio: async (lease) => {
        during = native.receiving;
        calls.push(['release', lease]);
      },
    },
    (message) => messages.push(message),
  );
  await native.start('s1', () => {});
  assert.equal(native.active, true);
  await native.release();
  assert.deepEqual(calls, [
    ['acquire', 'capture-1', 's1'],
    ['release', 'capture-1'],
  ]);
  assert.equal(during, false, 'a switch drops the helper audio at once');
  assert.match(messages[0], /uses ScreenCaptureKit\. Needs macOS 14\.2\./);
  await native.release();
  assert.equal(calls.length, 2, 'releasing again does nothing');
});

test('ending the recording keeps the helper audio until the helper stopped', async () => {
  let during;
  const native = new NativeSystemAudio(
    {
      startSystemAudio: async () => {},
      stopSystemAudio: async () => {
        during = native.receiving;
      },
    },
    () => {},
  );
  await native.start('s1', () => {});
  await native.end();
  assert.equal(during, true);
  assert.equal(native.receiving, false);
});

test('a start cancelled by the helper or by the recording still releases its lease', async () => {
  const released = [];
  const cancelled = new NativeSystemAudio(
    {
      acquireSystemAudio: async () => ({ cancelled: true }),
      releaseSystemAudio: async (lease) => released.push(lease),
    },
    () => {},
  );
  await assert.rejects(
    cancelled.start('s1', () => {}),
    /Incoming audio start was cancelled/,
  );
  await cancelled.end();
  const replaced = new NativeSystemAudio(
    { acquireSystemAudio: async () => ({}), releaseSystemAudio: async (lease) => released.push(lease) },
    () => {},
  );
  await assert.rejects(
    replaced.start('s1', () => {
      throw new Error('Audio startup was cancelled.');
    }),
    /cancelled/,
  );
  assert.equal(replaced.active, false);
  await replaced.end();
  assert.deepEqual(released, ['capture-1', 'capture-1']);
});

test('a failing release is reported, not thrown', async () => {
  const messages = [];
  const native = new NativeSystemAudio(
    {
      acquireSystemAudio: async () => ({}),
      releaseSystemAudio: async () => {
        throw new Error('The helper did not answer.');
      },
    },
    (message) => messages.push(message),
  );
  await native.start('s1', () => {});
  await native.end();
  assert.deepEqual(messages, ['The helper did not answer.']);
  assert.equal(native.active, false);
});

test('the helper packets reach the recording only for its session while it receives', async () => {
  const listeners = {};
  const native = new NativeSystemAudio(
    {
      startSystemAudio: async () => {},
      stopSystemAudio: async () => {},
      onSystemAudio: (listener) => ((listeners.audio = listener), () => {}),
      onSystemAudioError: (listener) => ((listeners.error = listener), () => {}),
    },
    () => {},
  );
  const packets = [],
    errors = [];
  assert.equal(
    native.listen({
      packet: (segment, samples) => packets.push(samples.length),
      error: (message) => errors.push(message),
    }).length,
    2,
  );
  const packet = (sessionId) => ({ sessionId, speaker: 'THEY', bytes: new ArrayBuffer(44 + 8) });
  listeners.audio(packet('s1'));
  listeners.error('before the start');
  await native.start('s1', () => {});
  listeners.audio(packet('other'));
  listeners.audio(packet('s1'));
  listeners.error('The helper stopped.');
  await native.end();
  listeners.audio(packet('s1'));
  assert.deepEqual(packets, [4]);
  assert.deepEqual(errors, ['The helper stopped.']);
});
