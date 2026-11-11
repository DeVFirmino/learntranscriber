const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { RealtimeTranscription } = require('../src/main/infrastructure/providers/realtime-transcription.cjs');
const { resample16kTo24k } = require('../src/main/domain/audio/pcm.cjs');

// A fake socket records what the client sends; the test plays the server.
function fakeSocket(sockets) {
  return class FakeSocket {
    constructor(url, options) {
      this.url = url;
      this.options = options;
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
  };
}
function harness(t, { provider = 'openai', live = true, key = 'sk-test' } = {}) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  repos.settings.update({ transcriptionProvider: provider, liveTranscription: live });
  const session = repos.sessions.create('Live', 'general'),
    captions = [],
    sockets = [];
  const engine = new RealtimeTranscription(
    repos,
    async () => key,
    (value) => captions.push(value),
    { WebSocketImpl: fakeSocket(sockets), finishTimeoutMs: 200 },
  );
  return { repos, session, captions, sockets, engine };
}
const speech = (seconds) => new Int16Array(16000 * seconds).fill(4000).buffer;
const silence = (seconds) => new Int16Array(16000 * seconds).buffer;
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('it runs only when OpenAI live captions are chosen and a key exists', async (t) => {
  const local = harness(t, { provider: 'local' });
  await assert.rejects(local.engine.start(1, local.session.id), /Select OpenAI and enable live captions/);
  const noLive = harness(t, { live: false });
  await assert.rejects(noLive.engine.start(1, noLive.session.id), /Select OpenAI and enable live captions/);
  const noKey = harness(t, { key: '' });
  await assert.rejects(noKey.engine.start(1, noKey.session.id), /Add an OpenAI API key/);
  assert.equal(noKey.engine.owns(1), false);
});

test('audio streams as 24 kHz PCM, a pause commits the turn and the completed transcript is saved once', async (t) => {
  const { repos, session, captions, sockets, engine } = harness(t);
  await engine.start(1, session.id);
  assert.equal(sockets.length, 0, 'no connection before audio arrives');
  engine.push(1, { sessionId: session.id, speaker: 'THEY', samples: speech(1) });
  engine.push(1, { sessionId: session.id, speaker: 'THEY', samples: silence(2) });
  await tick();
  const socket = sockets[0];
  assert.equal(socket.url, 'wss://api.openai.com/v1/realtime?intent=transcription');
  assert.equal(socket.options.headers.Authorization, 'Bearer sk-test');
  assert.deepEqual(socket.sent[0].session.audio.input.format, { type: 'audio/pcm', rate: 24000 });
  assert.equal(socket.sent[0].session.audio.input.transcription.model, 'gpt-live-transcribe');
  assert.equal(socket.sent[0].session.audio.input.turn_detection, null);
  const appends = socket.sent.filter((event) => event.type === 'input_audio_buffer.append');
  assert.equal(
    Buffer.from(appends[0].audio, 'base64').length,
    480 * 2,
    'each 20 ms frame becomes 480 samples at 24 kHz',
  );
  assert.equal(socket.sent.filter((event) => event.type === 'input_audio_buffer.commit').length, 1);
  socket.server({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'i1', delta: 'We ship' });
  socket.server({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'i1', delta: ' Friday.' });
  socket.server({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'i1',
    transcript: 'We ship Friday.',
  });
  assert.deepEqual(
    captions.map((c) => [c.text, c.final]),
    [
      ['We ship', false],
      ['We ship Friday.', false],
      ['We ship Friday.', true],
    ],
  );
  assert.deepEqual(
    repos.sessions.get(session.id).entries.map((e) => [e.kind, e.speaker, e.content]),
    [['transcript', 'THEY', 'We ship Friday.']],
  );
});

test('a graceful stop commits the last words and waits for them; discard closes at once', async (t) => {
  const { repos, session, sockets, engine } = harness(t);
  await engine.start(1, session.id);
  engine.push(1, { sessionId: session.id, speaker: 'ME', samples: speech(1) });
  await tick();
  const stopping = engine.stop(1);
  await tick();
  const socket = sockets[0];
  assert.equal(socket.sent.at(-1).type, 'input_audio_buffer.commit');
  socket.server({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'i2',
    transcript: 'Last words.',
  });
  assert.equal(await stopping, true);
  assert.equal(socket.closed, true);
  assert.equal(engine.owns(1), false);
  assert.equal(repos.sessions.get(session.id).entries[0].content, 'Last words.');
  const other = harness(t);
  await other.engine.start(1, other.session.id);
  other.engine.push(1, { sessionId: other.session.id, speaker: 'ME', samples: speech(1) });
  await tick();
  await other.engine.stop(1, true);
  assert.equal(
    other.sockets[0].sent.some((event) => event.type === 'input_audio_buffer.commit'),
    false,
  );
});

test('a provider error is shown and stops further audio', async (t) => {
  const { session, captions, sockets, engine } = harness(t);
  await engine.start(1, session.id);
  engine.push(1, { sessionId: session.id, speaker: 'ME', samples: speech(1) });
  await tick();
  sockets[0].server({ type: 'error', error: { message: 'insufficient_quota' } });
  assert.match(captions.at(-1).error, /Check the key, model access and billing/);
  assert.throws(() => engine.push(1, { sessionId: session.id, speaker: 'ME', samples: speech(1) }), /Check the key/);
  await assert.rejects(engine.stop(1), /Check the key/);
});

test('resampling keeps the signal and length ratio', () => {
  const input = Int16Array.from([0, 300, 600, 900]);
  assert.deepEqual([...resample16kTo24k(input)], [0, 200, 400, 600, 800, 900]);
});
