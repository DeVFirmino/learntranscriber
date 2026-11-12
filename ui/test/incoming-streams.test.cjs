// The window opens the microphone, a loopback input or the shared screen's audio, and stops a stream that arrives
// for a recording that is no longer current.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

function browser({ audioTracks = 1 } = {}) {
  const requests = [],
    stopped = [];
  const stream = (name, audio) => {
    const track = { stop: () => stopped.push(name) };
    return { name, getTracks: () => [track], getAudioTracks: () => (audio ? [track] : []) };
  };
  const navigator = {
    mediaDevices: {
      getUserMedia: async (constraints) => (requests.push(constraints), stream('input', true)),
      getDisplayMedia: async (constraints) => (requests.push(constraints), stream('display', audioTracks > 0)),
    },
  };
  class MediaStream {
    constructor(tracks) {
      this.tracks = tracks;
    }
  }
  return {
    requests,
    stopped,
    streams: loadTs('src/audio/incoming-streams.ts', { navigator, MediaStream, Error }),
  };
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test('the default microphone is opened with the browser echo cancellation, a chosen one by its id', async () => {
  const { requests, streams } = browser();
  await streams.openMicrophone('default', () => {});
  await streams.openMicrophone('usb-mic', () => {});
  assert.deepEqual(plain(requests.map((request) => request.audio)), [
    { echoCancellation: true, noiseSuppression: true },
    { deviceId: { exact: 'usb-mic' }, echoCancellation: true, noiseSuppression: true },
  ]);
});

test('a loopback input is recorded unprocessed and must be chosen first', async () => {
  const { requests, streams } = browser();
  await assert.rejects(
    streams.openLoopback('', () => {}),
    /Choose the input device/,
  );
  assert.equal(requests.length, 0);
  await streams.openLoopback('loopback', () => {});
  assert.deepEqual(plain(requests[0].audio), {
    deviceId: { exact: 'loopback' },
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  });
});

test('shared screen audio is recorded on its own, and a share without audio is stopped', async () => {
  const shared = browser();
  const display = await shared.streams.openDisplayAudio(() => {});
  assert.equal(display.owner.name, 'display');
  assert.equal(display.stream.tracks.length, 1);
  const silent = browser({ audioTracks: 0 });
  await assert.rejects(
    silent.streams.openDisplayAudio(() => {}),
    /System audio was not provided/,
  );
  assert.deepEqual(silent.stopped, ['display']);
});

test('a stream for a recording that is no longer current is handed to the guard', async () => {
  const { streams } = browser();
  const guarded = [];
  await assert.rejects(
    streams.openMicrophone('default', (stream) => {
      guarded.push(stream.name);
      throw new Error('Audio startup was cancelled.');
    }),
    /cancelled/,
  );
  assert.deepEqual(guarded, ['input']);
});

test('a microphone that macOS refuses fails with the setting to change, before any stream is guarded', async () => {
  const navigator = {
    mediaDevices: {
      getUserMedia: async () => {
        throw Object.assign(new Error('Permission denied by system'), { name: 'NotAllowedError' });
      },
    },
  };
  const streams = loadTs('src/audio/incoming-streams.ts', { navigator, MediaStream: class {}, Error });
  const guarded = [];
  await assert.rejects(
    streams.openMicrophone('default', (stream) => guarded.push(stream)),
    /Privacy & Security → Microphone/,
  );
  assert.deepEqual(guarded, []);
});
