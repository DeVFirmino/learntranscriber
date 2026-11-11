const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createLiveSessions } = require('../src/main/application/audio/live-session.cjs');
const { createSegmentTranscription } = require('../src/main/application/audio/transcribe.cjs');
const { createSystemAudioCapture } = require('../src/main/application/audio/system-audio.cjs');
const { createTranscriptionJobs } = require('../src/main/application/audio/transcription-jobs.cjs');

function engine(name, log, owned = new Set()) {
  return {
    owns: (owner) => owned.has(owner),
    start: (owner, id) => {
      owned.add(owner);
      log.push(`${name}:start:${owner}:${id}`);
      return true;
    },
    push: (owner) => {
      log.push(`${name}:push:${owner}`);
      return true;
    },
    stop: (owner) => {
      owned.delete(owner);
      log.push(`${name}:stop:${owner}`);
      return true;
    },
    updateLanguage: (owner, id, language) => {
      log.push(`${name}:language:${owner}:${language}`);
      return true;
    },
  };
}

test('live pushes and stops follow the engine the window started', () => {
  const log = [],
    active = createActiveSession();
  active.set('s1');
  let provider = 'apple';
  const live = createLiveSessions({
    active,
    settings: () => ({ transcriptionProvider: provider }),
    apple: engine('apple', log),
    whisper: engine('whisper', log),
  });
  live.start(1, 's1');
  provider = 'local';
  live.start(2, 's1');
  live.push(1, { sessionId: 's1' });
  live.push(2, { sessionId: 's1' });
  live.stop(1);
  live.stop(2);
  assert.deepEqual(log, [
    'apple:start:1:s1',
    'whisper:start:2:s1',
    'apple:push:1',
    'whisper:push:2',
    'apple:stop:1',
    'whisper:stop:2',
  ]);
});

test('Gemini live captions start, push, re-language and stop on the Gemini Live engine', () => {
  const log = [],
    active = createActiveSession();
  active.set('s1');
  const live = createLiveSessions({
    active,
    settings: () => ({ transcriptionProvider: 'gemini' }),
    apple: engine('apple', log),
    whisper: engine('whisper', log),
    realtime: engine('realtime', log),
    gemini: engine('gemini', log),
  });
  live.start(1, 's1');
  live.push(1, { sessionId: 's1' });
  live.updateLanguage(1, { sessionId: 's1', language: 'pt' });
  live.stop(1);
  assert.deepEqual(log, ['gemini:start:1:s1', 'gemini:push:1', 'gemini:language:1:pt', 'gemini:stop:1']);
});

test('live channels refuse sessions that are not live', () => {
  const log = [],
    active = createActiveSession();
  active.set('s1');
  const live = createLiveSessions({
    active,
    settings: () => ({ transcriptionProvider: 'local' }),
    apple: engine('apple', log),
    whisper: engine('whisper', log),
  });
  assert.throws(() => live.start(1, 's2'), /Start or resume this session first/);
  assert.throws(() => live.push(1, { sessionId: 's2' }), /no longer active/);
  assert.throws(() => live.updateLanguage(1, { sessionId: 's2' }), /Start or resume this session first/);
  assert.deepEqual(log, []);
});

test('system audio starts only for the live session with incoming audio enabled', async () => {
  const active = createActiveSession();
  active.set('s1');
  const started = [];
  let enabled = false;
  const capture = createSystemAudioCapture({
    active,
    settings: () => ({ systemAudio: enabled, systemAudioSource: 'native', displayId: '1', liveTranscription: true }),
    systemAudio: {
      start: async (...args) => {
        started.push(args);
        return true;
      },
    },
  });
  await assert.rejects(capture.start('s1'), /Enable incoming audio/);
  enabled = true;
  await assert.rejects(capture.start('s2'), /Enable incoming audio/);
  assert.deepEqual(await capture.start('s1'), { route: 'native' });
  assert.deepEqual(started, [['s1', '1', true]]);
});

test('a segment is saved and published once; an empty or repeated one is not', async (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const session = repos.sessions.create('Live', 'general'),
    active = createActiveSession();
  active.set(session.id);
  let changes = 0,
    result = 'We ship Friday.';
  const segments = createSegmentTranscription({
    active,
    jobs: createTranscriptionJobs(),
    settings: () => ({}),
    timeout: () => new AbortController().signal,
    changed: () => changes++,
    transcripts: {
      segment: (id, segmentId) => repos.entries.segment(id, segmentId),
      add: (id, content, speaker, segmentId) => repos.entries.add(id, 'transcript', content, speaker, segmentId),
    },
    transcribe: async () => result,
  });
  const segment = {
    sessionId: session.id,
    speaker: 'ME',
    mime: 'audio/wav',
    bytes: new ArrayBuffer(4),
    segmentId: 'seg-1',
  };
  assert.equal(await segments.transcribe(segment), 'We ship Friday.');
  result = 'Different text.';
  assert.equal(await segments.transcribe(segment), 'We ship Friday.');
  result = '';
  assert.equal(await segments.transcribe({ ...segment, segmentId: 'seg-2' }), '');
  assert.equal(repos.sessions.get(session.id).entries.length, 1);
  assert.equal(changes, 1);
  assert.throws(
    () => segments.transcribe({ ...segment, sessionId: 'other' }),
    /Start or resume this session before recording/,
  );
  assert.throws(() => segments.transcribe({ ...segment, speaker: 'HIM' }), /Invalid speaker/);
  assert.throws(() => segments.transcribe({ ...segment, mime: 'audio/flac' }), /Unsupported audio format/);
});

test('concurrent retries of one segment share one transcription, one saved line and one publication', async (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const session = repos.sessions.create('Live', 'general'),
    active = createActiveSession();
  active.set(session.id);
  let changes = 0,
    calls = 0,
    finish;
  const segments = createSegmentTranscription({
    active,
    jobs: createTranscriptionJobs(),
    settings: () => ({}),
    timeout: () => new AbortController().signal,
    changed: () => changes++,
    transcripts: {
      segment: (id, segmentId) => repos.entries.segment(id, segmentId),
      add: (id, content, speaker, segmentId) => repos.entries.add(id, 'transcript', content, speaker, segmentId),
    },
    transcribe: () => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const segment = {
    sessionId: session.id,
    speaker: 'ME',
    mime: 'audio/wav',
    bytes: new ArrayBuffer(4),
    segmentId: 'seg-1',
  };
  const first = segments.transcribe(segment),
    second = segments.transcribe(segment);
  await new Promise((resolve) => setImmediate(resolve));
  finish('Only result');
  assert.deepEqual(await Promise.all([first, second]), ['Only result', 'Only result']);
  assert.equal(calls, 1);
  assert.equal(changes, 1);
  assert.equal(repos.sessions.get(session.id).entries.length, 1);
  assert.throws(() => segments.transcribe({ ...segment, segmentId: '' }), /Invalid audio segment/);
});

test('OpenAI live captions route to the streaming engine for the window that started them', () => {
  const log = [],
    active = createActiveSession();
  active.set('s1');
  const live = createLiveSessions({
    active,
    settings: () => ({ transcriptionProvider: 'openai' }),
    apple: engine('apple', log),
    whisper: engine('whisper', log),
    realtime: engine('realtime', log),
  });
  live.start(1, 's1');
  live.push(1, { sessionId: 's1' });
  live.updateLanguage(1, { sessionId: 's1', language: 'pt' });
  live.stop(1);
  assert.deepEqual(log, ['realtime:start:1:s1', 'realtime:push:1', 'realtime:language:1:pt', 'realtime:stop:1']);
});

test('pause gates live frames by owner without stopping or restarting its engine', () => {
  const log = [],
    active = createActiveSession();
  active.set('s1');
  const apple = engine('apple', log);
  apple.setPaused = (owner, value) => log.push(`apple:pause:${owner}:${value}`);
  const live = createLiveSessions({
    active,
    settings: () => ({ transcriptionProvider: 'apple' }),
    apple,
    whisper: engine('whisper', log),
  });
  live.start(1, 's1');
  live.setPaused(1, true);
  live.push(1, { sessionId: 's1' });
  assert.equal(
    log.some((x) => x === 'apple:push:1'),
    false,
  );
  assert.throws(() => live.setPaused(2, true), /no longer active/);
  assert.throws(() => live.setPaused(1, 'yes'), /Invalid pause/);
  live.setPaused(1, false);
  live.push(1, { sessionId: 's1' });
  assert.ok(log.includes('apple:push:1'));
  assert.equal(log.filter((x) => x.includes(':start:')).length, 1);
  assert.equal(
    log.some((x) => x.includes(':stop:')),
    false,
  );
});
