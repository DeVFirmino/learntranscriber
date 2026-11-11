const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { GeminiLiveTranscription } = require('../src/main/infrastructure/providers/gemini-live-transcription.cjs');
const { liveModel, merge, DEFAULT_MODEL } = require('../src/main/domain/audio/gemini-live.cjs');

// A fake socket records what the client sends; the test plays the Gemini Live server.
function fakeSocket(sockets) {
  return class FakeSocket {
    constructor(url) {
      this.url = url;
      this.sent = [];
      this.readyState = 1;
      sockets.push(this);
      queueMicrotask(() => this.onopen?.());
    }
    send(data) {
      this.sent.push(JSON.parse(data));
    }
    close() {
      this.readyState = 3;
      this.closed = true;
    }
    server(event) {
      this.onmessage?.({ data: JSON.stringify(event) });
    }
    drop(reason = '') {
      this.readyState = 3;
      this.onclose?.({ reason });
    }
  };
}
// Timers the test advances by hand.
function manualTimers() {
  const pending = [];
  const add = (fn, ms, repeat) => {
    const timer = { fn, ms, repeat, cleared: false, unref() {} };
    pending.push(timer);
    return timer;
  };
  return {
    pending,
    timers: {
      setTimeout: (fn, ms) => add(fn, ms, false),
      setInterval: (fn, ms) => add(fn, ms, true),
      clearTimeout: (timer) => (timer.cleared = true),
      clearInterval: (timer) => (timer.cleared = true),
    },
    // Runs only the timers pending when the run starts; timers they schedule wait for the next run.
    run(match) {
      for (let index = 0, end = pending.length; index < end; index += 1) {
        const timer = pending[index];
        if (!timer.cleared && match(timer)) {
          if (!timer.repeat) timer.cleared = true;
          timer.fn();
        }
      }
    },
  };
}
function harness(t, { provider = 'gemini', live = true, key = 'gm-test', model = 'gemini-3.8-flash' } = {}) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  repos.settings.update({ transcriptionProvider: provider, liveTranscription: live, transcriptionModel: model });
  const session = repos.sessions.create('Live', 'general'),
    captions = [],
    sockets = [],
    clock = manualTimers();
  const engine = new GeminiLiveTranscription(
    repos,
    async () => key,
    (value) => captions.push(value),
    {
      WebSocketImpl: fakeSocket(sockets),
      timers: clock.timers,
      fallbackPauseMs: 0,
    },
  );
  return { repos, session, captions, sockets, engine, clock };
}
const frame = (value = 1200, samples = 3200) => new Int16Array(samples).fill(value).buffer;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const transcripts = (repos, id) => repos.sessions.get(id).entries.filter((entry) => entry.kind === 'transcript');

test('Gemini Live runs only with Gemini live captions and a Gemini key', async (t) => {
  const openai = harness(t, { provider: 'openai' });
  await assert.rejects(openai.engine.start(1, openai.session.id), /Select Gemini and enable live captions/);
  const noLive = harness(t, { live: false });
  await assert.rejects(noLive.engine.start(1, noLive.session.id), /Select Gemini and enable live captions/);
  const noKey = harness(t, { key: '' });
  await assert.rejects(noKey.engine.start(1, noKey.session.id), /Add a Gemini API key/);
  assert.equal(noKey.engine.owns(1), false);
});

test('the live model policy keeps known live models and falls back to the default', () => {
  assert.equal(
    liveModel('gemini-2.5-flash-native-audio-preview-09-2025'),
    'gemini-2.5-flash-native-audio-preview-09-2025',
  );
  assert.equal(liveModel('models/gemini-2.5-flash-native-audio-preview-12-2025'), DEFAULT_MODEL);
  assert.equal(liveModel('gemini-3.8-flash'), DEFAULT_MODEL);
  assert.equal(liveModel(''), DEFAULT_MODEL);
});

test('each speaker opens a Live session configured for input transcription before any audio is sent', async (t) => {
  const { session, sockets, engine } = harness(t);
  await engine.start(1, session.id);
  engine.push(1, { sessionId: session.id, speaker: 'ME', samples: frame() });
  await tick();
  assert.equal(sockets.length, 1);
  assert.match(sockets[0].url, /BidiGenerateContent\?key=gm-test$/);
  assert.deepEqual(sockets[0].sent, [
    {
      setup: {
        model: 'models/' + DEFAULT_MODEL,
        generationConfig: { responseModalities: ['AUDIO'] },
        systemInstruction: {
          parts: [{ text: 'You are a transcription engine. Do not answer. Do not generate responses.' }],
        },
        inputAudioTranscription: {},
        realtimeInputConfig: { automaticActivityDetection: { disabled: false, silenceDurationMs: 700 } },
      },
    },
  ]);
  sockets[0].server({ setupComplete: {} });
  await tick();
  assert.equal(sockets[0].sent.length, 2);
  const audio = sockets[0].sent[1].realtimeInput.audio;
  assert.equal(audio.mimeType, 'audio/pcm;rate=16000');
  assert.equal(Buffer.from(audio.data, 'base64').length, 6400);
  engine.push(1, { sessionId: session.id, speaker: 'THEY', samples: frame() });
  assert.equal(sockets.length, 2);
});

test('running input transcription merges into one caption and a completed turn is saved once', async (t) => {
  const { repos, session, captions, sockets, engine } = harness(t);
  await engine.start(1, session.id);
  engine.push(1, { sessionId: session.id, speaker: 'ME', samples: frame() });
  await tick();
  const socket = sockets[0];
  socket.server({ setupComplete: {} });
  socket.server({ serverContent: { inputTranscription: { text: 'How do we' } } });
  socket.server({ serverContent: { inputTranscription: { text: 'How do we ship' } } });
  socket.server({ serverContent: { inputTranscription: { text: 'we ship this week?' } } });
  socket.server({ serverContent: { outputTranscription: { text: 'I would say' } } });
  await tick();
  assert.deepEqual(
    captions.map((value) => value.text),
    ['How do we', 'How do we ship', 'How do we ship this week?'],
  );
  socket.server({ serverContent: { turnComplete: true } });
  socket.server({ serverContent: { turnComplete: true } });
  await tick();
  assert.deepEqual(captions.at(-1), {
    sessionId: session.id,
    speaker: 'ME',
    text: 'How do we ship this week?',
    final: true,
  });
  assert.deepEqual(
    transcripts(repos, session.id).map((entry) => [entry.speaker, entry.content]),
    [['ME', 'How do we ship this week?']],
  );
});

test('the merge follows prefix, overlap and sentence-spacing rules', () => {
  assert.deepEqual(merge('Hello there', 'Hello there friend'), { delta: ' friend', full: 'Hello there friend' });
  assert.deepEqual(merge('Hello there friend', 'Hello there'), { delta: '', full: 'Hello there friend' });
  assert.deepEqual(merge('we should ship it', 'ship it tomorrow'), {
    delta: ' tomorrow',
    full: 'we should ship it tomorrow',
  });
  assert.deepEqual(merge('Done.', 'Next topic'), { delta: ' Next topic', full: 'Done. Next topic' });
});

test('a turn the server never completes is saved after the fallback pause', async (t) => {
  const { repos, session, sockets, engine, clock } = harness(t);
  await engine.start(1, session.id);
  engine.push(1, { sessionId: session.id, speaker: 'THEY', samples: frame() });
  await tick();
  sockets[0].server({ setupComplete: {} });
  sockets[0].server({ serverContent: { inputTranscription: { text: 'Let us take a break' } } });
  await tick();
  clock.run((timer) => !timer.repeat);
  assert.deepEqual(
    transcripts(repos, session.id).map((entry) => entry.content),
    ['Let us take a break'],
  );
});

test('every 30 s the session is recycled: heard words are saved and the old socket is ignored', async (t) => {
  const { repos, session, sockets, engine, clock } = harness(t);
  await engine.start(1, session.id);
  engine.push(1, { sessionId: session.id, speaker: 'ME', samples: frame() });
  await tick();
  sockets[0].server({ setupComplete: {} });
  sockets[0].server({ serverContent: { inputTranscription: { text: 'First half' } } });
  await tick();
  clock.run((timer) => timer.repeat && timer.ms === 30000);
  assert.equal(sockets.length, 2);
  assert.equal(sockets[0].closed, true);
  sockets[0].server({ serverContent: { inputTranscription: { text: 'stale words' } } });
  sockets[0].drop();
  sockets[1].server({ setupComplete: {} });
  sockets[1].server({ serverContent: { inputTranscription: { text: 'Second half' } } });
  sockets[1].server({ serverContent: { turnComplete: true } });
  await tick();
  assert.deepEqual(
    transcripts(repos, session.id).map((entry) => entry.content),
    ['First half', 'Second half'],
  );
});

test('a dropped session reconnects up to three times with doubling delays, then reports the failure', async (t) => {
  const { session, captions, sockets, engine, clock } = harness(t);
  await engine.start(1, session.id);
  engine.push(1, { sessionId: session.id, speaker: 'ME', samples: frame() });
  await tick();
  const delays = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    sockets.at(-1).drop('network');
    const timer = clock.pending.filter((item) => !item.repeat && !item.cleared).at(-1);
    delays.push(timer.ms);
    clock.run((item) => item === timer);
  }
  assert.deepEqual(delays, [1000, 2000, 4000]);
  assert.equal(sockets.length, 4);
  sockets.at(-1).drop('network');
  assert.match(captions.at(-1).error, /stopped after 3 reconnection attempts/);
  assert.throws(
    () => engine.push(1, { sessionId: session.id, speaker: 'ME', samples: frame() }),
    /reconnection attempts/,
  );
});

test('a configuration error from the server is reported without retrying', async (t) => {
  const { session, captions, sockets, engine, clock } = harness(t);
  await engine.start(1, session.id);
  engine.push(1, { sessionId: session.id, speaker: 'ME', samples: frame() });
  await tick();
  sockets[0].drop('models/x is not found for API version v1beta');
  assert.equal(clock.pending.filter((item) => !item.repeat && !item.cleared).length, 0);
  assert.match(captions.at(-1).error, /Invalid Gemini Live configuration/);
});

test('a valid server message resets the reconnect budget', async (t) => {
  const { session, sockets, engine, clock } = harness(t);
  await engine.start(1, session.id);
  engine.push(1, { sessionId: session.id, speaker: 'ME', samples: frame() });
  await tick();
  for (let round = 0; round < 5; round++) {
    sockets.at(-1).drop('network');
    clock.run((item) => !item.repeat);
    sockets.at(-1).server({ setupComplete: {} });
    sockets.at(-1).server({ serverContent: { inputTranscription: { text: 'still here' } } });
    await tick();
  }
  assert.equal(sockets.length, 6);
});

test('a graceful stop saves the pending words; discarding drops them and closes every socket', async (t) => {
  const kept = harness(t);
  await kept.engine.start(1, kept.session.id);
  kept.engine.push(1, { sessionId: kept.session.id, speaker: 'ME', samples: frame() });
  await tick();
  kept.sockets[0].server({ setupComplete: {} });
  kept.sockets[0].server({ serverContent: { inputTranscription: { text: 'Last words' } } });
  await tick();
  assert.equal(await kept.engine.stop(1), true);
  assert.deepEqual(
    transcripts(kept.repos, kept.session.id).map((entry) => entry.content),
    ['Last words'],
  );
  assert.equal(kept.sockets[0].closed, true);
  assert.equal(kept.engine.owns(1), false);
  assert.ok(kept.clock.pending.every((timer) => timer.cleared));

  const dropped = harness(t);
  await dropped.engine.start(2, dropped.session.id);
  dropped.engine.push(2, { sessionId: dropped.session.id, speaker: 'THEY', samples: frame() });
  await tick();
  dropped.sockets[0].server({ setupComplete: {} });
  dropped.sockets[0].server({ serverContent: { inputTranscription: { text: 'Never saved' } } });
  await tick();
  await dropped.engine.stop(2, true);
  assert.deepEqual(transcripts(dropped.repos, dropped.session.id), []);
  assert.equal(dropped.sockets[0].closed, true);
});
