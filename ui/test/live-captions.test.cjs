// Live captions run for one recording when the settings ask for them, and their errors end only that recording.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { LiveCaptionSession } = loadTs('src/audio/live-captions.ts', { Promise, Error });

const live = (extra = {}) => ({
  microphoneId: 'default',
  systemAudio: true,
  systemAudioSource: 'native',
  liveTranscription: true,
  transcriptionProvider: 'openai',
  ...extra,
});
function api(extra = {}) {
  const calls = [];
  return {
    calls,
    api: {
      startLiveTranscription: async (id) => calls.push(['start', id]),
      pushLiveAudio: async () => true,
      stopLiveTranscription: async () => calls.push(['stop']),
      setLivePaused: async (paused) => calls.push(['pause', paused]),
      ...extra,
    },
  };
}

test('a recording without live captions starts, pauses and stops nothing', async () => {
  const { api: bridge, calls } = api();
  const session = new LiveCaptionSession(bridge);
  await session.start('s1', live({ liveTranscription: false }), () => {});
  await session.pause(true);
  assert.equal(await session.stop(), null);
  assert.equal(session.active, false);
  assert.deepEqual(calls, []);
});

test('live captions need the native app', async () => {
  const session = new LiveCaptionSession({});
  await assert.rejects(
    session.start('s1', live(), () => {}),
    /require the native Mac app/,
  );
  assert.equal(session.active, false);
  assert.equal(new LiveCaptionSession({ startLiveTranscription: async () => true }).pausable, true);
});

test('the window forwards helper audio unless Apple Speech hears it directly', async () => {
  const { api: bridge } = api();
  const session = new LiveCaptionSession(bridge);
  await session.start('s1', live({ transcriptionProvider: 'apple' }), () => {});
  assert.equal(session.forwardsHelper, false);
  session.follow(live({ transcriptionProvider: 'apple', systemAudioSource: 'input-device' }));
  assert.equal(session.forwardsHelper, true);
});

test('pausing and stopping reach the main process, and a failed stop is returned', async () => {
  const { api: bridge, calls } = api({
    stopLiveTranscription: async () => {
      throw new Error('Speech did not stop.');
    },
  });
  const session = new LiveCaptionSession(bridge);
  await session.start('s1', live(), () => {});
  await session.pause(true);
  assert.match((await session.stop()).message, /did not stop/);
  assert.equal(session.active, false);
  assert.deepEqual(calls, [
    ['start', 's1'],
    ['pause', true],
  ]);
  assert.equal(new LiveCaptionSession({ ...bridge, setLivePaused: undefined }).pausable, true);
});

test('caption errors end the recording only for its own running session', async () => {
  let listener;
  const { api: bridge } = api({ onLiveCaption: (next) => ((listener = next), () => {}) });
  const session = new LiveCaptionSession(bridge);
  const errors = [];
  assert.equal(session.listen((message) => errors.push(message)).length, 1);
  listener({ sessionId: 's1', error: 'before the start' });
  await session.start('s1', live(), () => {});
  listener({ sessionId: 'other', error: 'another session' });
  listener({ sessionId: 's1', text: 'hello' });
  listener({ sessionId: 's1', error: 'Speech stopped.' });
  assert.deepEqual(errors, ['Speech stopped.']);
  assert.equal(new LiveCaptionSession({}).listen(() => {}).length, 0);
});
