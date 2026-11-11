const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createLocalLiveTranscription } = require('../src/main/application/audio/local-live-transcription.cjs');
function frame(value = 1000, samples = 16000) {
  const data = new Int16Array(samples).fill(value);
  return data.buffer;
}
function fixture(transcribe = async () => 'Recognized speech') {
  const repos = createRepositories(openDatabase(':memory:')),
    id = repos.sessions.create('Live fixture', 'general').id;
  repos.settings.update({ transcriptionProvider: 'local', liveTranscription: true });
  const events = [];
  let released = 0;
  const live = createLocalLiveTranscription({
    ...repos,
    models: { acquire: () => ({ release: () => released++ }) },
    transcribe: transcribe,
    onCaption: (event) => events.push(event),
  });
  return {
    repos,
    id,
    live,
    events,
    get released() {
      return released;
    },
  };
}
const tick = () => new Promise(setImmediate);
test('live captions are provisional until pause; finalized text is stored once and keeps the speaker', async () => {
  const f = fixture();
  try {
    f.live.start(1, f.id);
    f.live.push(1, { sessionId: f.id, speaker: 'ME', samples: frame() });
    f.live.push(1, { sessionId: f.id, speaker: 'ME', samples: frame() });
    await tick();
    assert.equal(f.events.at(-1).final, false);
    assert.equal(f.repos.sessions.get(f.id).entries.length, 0);
    f.live.push(1, { sessionId: f.id, speaker: 'ME', samples: frame(0) });
    await f.live.stop(1);
    assert.equal(f.repos.sessions.get(f.id).entries.length, 1);
    assert.equal(f.repos.sessions.get(f.id).entries[0].speaker, 'ME');
    assert.equal(f.released, 1);
  } finally {
    await f.live.close();
    f.repos.db.close();
  }
});
test('silence is skipped, source ownership and PCM bounds are enforced', async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    return 'Unexpected';
  });
  try {
    f.live.start(1, f.id);
    assert.throws(() => f.live.push(2, { sessionId: f.id, speaker: 'ME', samples: frame() }), /active/);
    assert.throws(() => f.live.push(1, { sessionId: f.id, speaker: 'ME', samples: new ArrayBuffer(64002) }), /PCM/);
    f.live.push(1, { sessionId: f.id, speaker: 'THEY', samples: frame(0) });
    await f.live.stop(1);
    assert.equal(calls, 0);
    assert.equal(f.repos.sessions.get(f.id).entries.length, 0);
  } finally {
    await f.live.close();
    f.repos.db.close();
  }
});
test('closing aborts pending recognition and never writes a late result', async () => {
  let release;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  try {
    f.live.start(1, f.id);
    f.live.push(1, { sessionId: f.id, speaker: 'ME', samples: frame() });
    f.live.push(1, { sessionId: f.id, speaker: 'ME', samples: frame() });
    await tick();
    const closing = f.live.close();
    release('Late answer');
    await closing;
    assert.equal(f.repos.sessions.get(f.id).entries.length, 0);
    assert.equal(f.released, 1);
  } finally {
    f.repos.db.close();
  }
});
test('recognition failure clears the lease and is not accepted as a completed transcript', async () => {
  const f = fixture(async () => {
    throw Error('Private upstream details');
  });
  try {
    f.live.start(1, f.id);
    f.live.push(1, { sessionId: f.id, speaker: 'THEY', samples: frame() });
    await assert.rejects(f.live.stop(1), /restart listening/);
    assert.equal(f.released, 1);
    assert.equal(f.repos.sessions.get(f.id).entries.length, 0);
    assert.ok(!JSON.stringify(f.events).includes('Private upstream'));
  } finally {
    await f.live.close();
    f.repos.db.close();
  }
});
test('a failed final decode saves the complete stitched preview once', async () => {
  let previews = 0;
  const f = fixture(async (_audio, settings) => {
    if (settings.liveDecode === 'final') throw Error('decode failed');
    return `Preview ${++previews}`;
  });
  try {
    f.live.start(1, f.id);
    for (let i = 0; i < 3; i++) f.live.push(1, { sessionId: f.id, speaker: 'ME', samples: frame() });
    await f.live.stop(1);
    const entries = f.repos.sessions.get(f.id).entries;
    assert.equal(entries.length, 1);
    assert.match(entries[0].content, /Preview 1/);
    assert.equal(f.events.at(-1).final, true);
    assert.equal(f.events.at(-1).text, entries[0].content);
    assert.equal(f.released, 1);
  } finally {
    await f.live.close();
    f.repos.db.close();
  }
});
test('a slow preview queue skips drafts but keeps the final utterance', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let previews = 0;
  const f = fixture(async (_audio, settings) => {
    if (settings.liveDecode === 'final') return 'Complete utterance';
    previews++;
    if (previews === 1) await gate;
    return 'Draft';
  });
  try {
    f.live.start(1, f.id);
    for (let i = 0; i < 4; i++) f.live.push(1, { sessionId: f.id, speaker: 'THEY', samples: frame() });
    const stopping = f.live.stop(1);
    release();
    await stopping;
    assert.equal(f.repos.sessions.get(f.id).entries.length, 1);
    assert.equal(f.repos.sessions.get(f.id).entries[0].content, 'Complete utterance');
    assert.ok(previews <= 2);
    assert.equal(f.released, 1);
  } finally {
    await f.live.close();
    f.repos.db.close();
  }
});

test('live language changes keep buffered audio and in-flight options while the next decode uses the update', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const calls = [];
  const f = fixture(async (input, settings) => {
    calls.push({ settings, bytes: input.bytes.byteLength });
    if (calls.length === 1) await gate;
    return settings.liveDecode === 'final' ? 'Final updated transcript' : 'Draft';
  });
  try {
    f.repos.settings.update({ language: 'en', transcriptionPrompt: 'Original vocabulary' });
    f.live.start(1, f.id);
    f.live.push(1, { sessionId: f.id, speaker: 'ME', samples: frame() });
    await tick();
    assert.equal(calls.length, 1);
    const state = f.live.sessions.get(1),
      stream = state.sources.ME,
      buffered = stream.bytes;
    assert.deepEqual(f.live.updateLanguage(1, f.id, ' pt '), { sessionId: f.id, language: 'pt' });
    assert.equal(state.settings.transcriptionPrompt, 'Original vocabulary');
    f.live.updateLanguage(1, f.id, 'pt', 'Kubernetes, PostgreSQL');
    assert.equal(stream.bytes, buffered);
    assert.equal(state.sources.ME, stream);
    assert.equal(calls[0].settings.language, 'en');
    assert.equal(calls[0].settings.transcriptionPrompt, 'Original vocabulary');
    f.live.push(1, { sessionId: f.id, speaker: 'ME', samples: frame() });
    const stopping = f.live.stop(1);
    release();
    await stopping;
    assert.ok(
      calls
        .slice(1)
        .every(
          (call) => call.settings.language === 'pt' && call.settings.transcriptionPrompt === 'Kubernetes, PostgreSQL',
        ),
    );
    assert.equal(calls.at(-1).settings.liveDecode, 'final');
    assert.equal(calls.at(-1).bytes, 64000 + 44);
    assert.equal(f.repos.sessions.get(f.id).entries[0].content, 'Final updated transcript');
    assert.equal(f.repos.settings.read().language, 'en');
    assert.equal(f.released, 1);
  } finally {
    release?.();
    await f.live.close();
    f.repos.db.close();
  }
});

test('live language updates require ownership, preserve omitted vocabulary and reject invalid edits atomically', async () => {
  const f = fixture();
  try {
    f.repos.settings.update({ language: 'en', transcriptionPrompt: 'Retained vocabulary' });
    f.live.start(1, f.id);
    assert.throws(() => f.live.updateLanguage(2, f.id, 'pt', 'Wrong owner'), /no longer active/);
    assert.throws(() => f.live.updateLanguage(1, 'missing-session', 'pt'), /no longer active/);
    assert.throws(() => f.live.updateLanguage(1, f.id, 'pt', 'x'.repeat(2001)), /2,000/);
    const state = f.live.sessions.get(1);
    assert.equal(state.settings.language, 'en');
    assert.equal(state.settings.transcriptionPrompt, 'Retained vocabulary');
    f.live.updateLanguage(1, f.id, '  ', null);
    assert.equal(state.settings.language, 'auto');
    assert.equal(state.settings.transcriptionPrompt, 'Retained vocabulary');
    f.live.updateLanguage(1, f.id, undefined, '');
    assert.equal(state.settings.transcriptionPrompt, '');
    await f.live.stop(1);
    assert.throws(() => f.live.updateLanguage(1, f.id, 'pt'), /no longer active/);
  } finally {
    await f.live.close();
    f.repos.db.close();
  }
});
test('an utterance longer than a native segment still gets its own final decode', async () => {
  const finals = [];
  const f = fixture(async (audio, settings) => {
    if (settings.liveDecode === 'final') finals.push(audio.bytes.byteLength - 44);
    return settings.liveDecode === 'final' ? 'Whole long utterance' : 'Draft';
  });
  try {
    f.live.start(1, f.id);
    // 61 one-second frames of continuous speech: past the 16 s native bound and the 60 s utterance limit.
    for (let i = 0; i < 61; i++) {
      f.live.push(1, { sessionId: f.id, speaker: 'THEY', samples: frame() });
      await tick();
    }
    await f.live.stop(1);
    assert.equal(finals[0], 1920000);
    assert.deepEqual(
      f.repos.sessions.get(f.id).entries.map((entry) => entry.content),
      ['Whole long utterance', 'Whole long utterance'],
    );
  } finally {
    await f.live.close();
    f.repos.db.close();
  }
});
