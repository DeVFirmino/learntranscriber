const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { AppleSpeechSessions } = require('../src/main/infrastructure/native/apple-speech-sessions.cjs');

const fixture = path.join(__dirname, 'fixtures/apple-session-helper.cjs');
const fixtureSpawn =
  (mode = '') =>
  (_executable, args, options) =>
    spawn(process.execPath, [fixture, ...args, ...(mode ? [mode] : [])], { stdio: options.stdio });
const packet = () => new Int16Array([1000, -1000, 500]).buffer;

test('persistent Apple helpers keep microphone and native output separate and save only final text', async () => {
  const repos = createRepositories(openDatabase(':memory:'));
  repos.settings.update({ transcriptionProvider: 'apple', liveTranscription: true, systemAudio: true });
  const session = repos.sessions.create('Conversation', 'general');
  const captions = [];
  const readyLocales = [];
  const service = new AppleSpeechSessions(repos, '/fixture/helper', (value) => captions.push(value), {
    spawn: fixtureSpawn(),
    onReady: (locale) => readyLocales.push(locale),
    readyTimeout: 2000,
    stopTimeout: 500,
  });
  try {
    await service.start(11, session.id);
    assert.deepEqual(readyLocales, ['en-US', 'en-US']);
    assert.throws(
      () => service.push(12, { sessionId: session.id, speaker: 'ME', samples: packet() }),
      /no longer active/,
    );
    assert.throws(
      () => service.push(11, { sessionId: session.id, speaker: 'ME', samples: new ArrayBuffer(3) }),
      /Invalid Apple Speech audio/,
    );
    service.push(11, { sessionId: session.id, speaker: 'ME', samples: packet() });
    const wav = require('../src/main/domain/audio/wav.cjs').wav(Buffer.from(packet()));
    assert.equal(service.pushSystem({ sessionId: session.id, bytes: Uint8Array.from(wav).buffer }), true);
    await service.stop(11);
    const entries = repos.sessions.get(session.id).entries.filter((item) => item.kind === 'transcript');
    assert.deepEqual(entries.map((item) => [item.speaker, item.content]).sort(), [
      ['ME', 'final ME'],
      ['THEY', 'final THEY'],
    ]);
    assert.equal(captions.filter((item) => item.final).length, 2);
    assert.deepEqual(
      captions
        .filter((item) => !item.final && !item.error)
        .map((item) => item.text)
        .sort(),
      ['draft ME', 'draft THEY'],
    );
    assert.equal(service.sessions.size, 0);
  } finally {
    await service.close();
    repos.db.close();
  }
});

test('Apple Speech preflight blocks unsupported streaming and cancelled startup cannot start a helper', async () => {
  const repos = createRepositories(openDatabase(':memory:'));
  repos.settings.update({ transcriptionProvider: 'apple', liveTranscription: true });
  const session = repos.sessions.create('Conversation', 'general');
  let spawned = 0,
    resolvePreflight;
  const preflight = () =>
    new Promise((resolve) => {
      resolvePreflight = resolve;
    });
  const service = new AppleSpeechSessions(repos, '/fixture/helper', () => {}, {
    spawn: (...args) => {
      spawned++;
      return fixtureSpawn()(...args);
    },
    preflight,
    stopTimeout: 500,
  });
  try {
    const starting = service.start(11, session.id);
    await assert.rejects(service.start(11, session.id), /previous Apple Speech session/);
    await service.stop(11, true);
    resolvePreflight({ authorization: 'authorized', supportsStreamingRecognition: true });
    await assert.rejects(starting, /startup was cancelled/);
    assert.equal(spawned, 0);
    assert.equal(service.sessions.size, 0);
  } finally {
    await service.close();
    repos.db.close();
  }
});

test('Apple Speech rejects denied authorization and unavailable streaming before spawning', async () => {
  const repos = createRepositories(openDatabase(':memory:'));
  repos.settings.update({ transcriptionProvider: 'apple', liveTranscription: true });
  const session = repos.sessions.create('Conversation', 'general');
  for (const [result, expected] of [
    [{ authorization: 'denied', supportsStreamingRecognition: true }, /Enable Speech Recognition/],
    [{ authorization: 'authorized', supportsStreamingRecognition: false }, /Streaming Apple Speech is unavailable/],
  ]) {
    const service = new AppleSpeechSessions(repos, '/fixture/helper', () => {}, {
      preflight: async () => result,
      spawn: () => {
        throw new Error('Must not spawn.');
      },
    });
    try {
      await assert.rejects(service.start(11, session.id), expected);
      assert.equal(service.sessions.size, 0);
    } finally {
      await service.close();
    }
  }
  repos.db.close();
});

test('startup errors and early stop leave no active helper or transcript', async () => {
  const repos = createRepositories(openDatabase(':memory:'));
  repos.settings.update({ transcriptionProvider: 'apple', liveTranscription: true });
  const session = repos.sessions.create('Conversation', 'general');
  const errorService = new AppleSpeechSessions(repos, '/fixture/helper', () => {}, {
    spawn: fixtureSpawn('--startup-error'),
    readyTimeout: 2000,
    stopTimeout: 500,
  });
  try {
    await assert.rejects(errorService.start(5, session.id), /Fixture language unavailable/);
    assert.equal(errorService.sessions.size, 0);
  } finally {
    await errorService.close();
  }
  const delayed = new AppleSpeechSessions(repos, '/fixture/helper', () => {}, {
    spawn: fixtureSpawn('--delay-ready'),
    readyTimeout: 2000,
    stopTimeout: 500,
  });
  try {
    const starting = delayed.start(6, session.id);
    await delayed.stop(6, true);
    await assert.rejects(starting, /before becoming ready/);
    assert.equal(delayed.sessions.size, 0);
    assert.equal(repos.sessions.get(session.id).entries.length, 0);
  } finally {
    await delayed.close();
    repos.db.close();
  }
});

test('paused Apple Speech drops both owner and direct native-output packets until resume', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  const id = repos.sessions.create('Pause', 'general').id;
  const writes = [];
  const service = new AppleSpeechSessions(repos, '/fixture', () => {});
  const part = {
    ready: true,
    ended: false,
    child: { stdin: { writable: true, writableLength: 0, write: (bytes) => writes.push(Buffer.from(bytes)) } },
  };
  service.sessions.set(9, {
    id,
    parts: new Map([
      ['ME', part],
      ['THEY', part],
    ]),
    stopping: false,
  });
  service.setPaused(9, true);
  service.push(9, { sessionId: id, speaker: 'ME', samples: packet() });
  const wav = require('../src/main/domain/audio/wav.cjs').wav(Buffer.from(packet()));
  assert.equal(service.pushSystem({ sessionId: id, bytes: Uint8Array.from(wav).buffer }), false);
  assert.equal(writes.length, 0);
  service.setPaused(9, false);
  service.push(9, { sessionId: id, speaker: 'ME', samples: packet() });
  assert.equal(writes.length, 1);
  assert.equal(service.pushSystem({ sessionId: id, bytes: Uint8Array.from(wav).buffer }), true);
  assert.equal(writes.length, 2);
  repos.db.close();
});
