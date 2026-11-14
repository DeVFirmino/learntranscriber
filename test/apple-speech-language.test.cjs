const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { AppleSpeechSessions } = require('../src/main/infrastructure/native/apple-speech-sessions.cjs');

const fixture = path.join(__dirname, 'fixtures/apple-session-helper.cjs');
const packet = () => new Int16Array([1000, -1000, 500]).buffer;
const value = (args, name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const streams = (supported) => async (locale) => ({
  authorization: 'authorized',
  supportsStreamingRecognition: supported.includes(locale),
});

// A service over the fixture helper that records each spawn's languages; `slow` delays the ready of later helpers.
function harness(t, settings, options = {}) {
  const repos = createRepositories(openDatabase(':memory:'));
  repos.settings.update({ transcriptionProvider: 'apple', liveTranscription: true, ...settings });
  const id = repos.sessions.create('Class', 'general').id;
  const spawned = [],
    captions = [],
    notices = [],
    readyLocales = [];
  const service = new AppleSpeechSessions(repos, '/fixture/helper', (caption) => captions.push(caption), {
    spawn: (_executable, args, spawnOptions) => {
      const mode = options.slow && spawned.length >= options.slow ? ['--delay-ready'] : [];
      spawned.push({
        session: value(args, '--session-id'),
        speaker: value(args, '--speaker-label'),
        language: value(args, '--language'),
        alternate: value(args, '--alternate-language'),
      });
      return spawn(process.execPath, [fixture, ...args, ...mode], { stdio: spawnOptions.stdio });
    },
    preflight: options.preflight,
    onReady: (locale) => readyLocales.push(locale),
    onNotice: (message) => notices.push(message),
    readyTimeout: 2000,
    stopTimeout: 500,
  });
  t.after(async () => {
    await service.close();
    repos.db.close();
  });
  const transcript = () =>
    repos.sessions
      .get(id)
      .entries.filter((item) => item.kind === 'transcript')
      .map((item) => [item.speaker, item.content])
      .sort();
  return { repos, id, spawned, captions, notices, readyLocales, service, transcript };
}

test('automatic speech gives every helper the Portuguese alternate and records both languages', async (t) => {
  const { id, spawned, readyLocales, service } = harness(t, { systemAudio: true, appleSpeechLocale: 'auto' });
  await service.start(1, id);
  assert.deepEqual(spawned, [
    { session: id, speaker: 'ME', language: 'en-US', alternate: 'pt-BR' },
    { session: id, speaker: 'THEY', language: 'en-US', alternate: 'pt-BR' },
  ]);
  assert.deepEqual(readyLocales, ['en-US', 'pt-BR', 'en-US', 'pt-BR']);
});

test('automatic speech listens in English alone when Portuguese cannot stream', async (t) => {
  const asked = [];
  const { id, spawned, service } = harness(
    t,
    { appleSpeechLocale: 'auto' },
    {
      preflight: (locale) => {
        asked.push(locale);
        return streams(['en-US'])(locale);
      },
    },
  );
  await service.start(1, id);
  assert.deepEqual(asked, ['en-US', 'pt-BR']);
  assert.deepEqual(spawned, [{ session: id, speaker: 'ME', language: 'en-US', alternate: null }]);
});

test('a language change restarts the running helpers for the same speakers without ending the session', async (t) => {
  const { repos, id, spawned, captions, service, transcript } = harness(
    t,
    { systemAudio: true, appleSpeechLocale: 'en-US' },
    { slow: 2 },
  );
  await service.start(1, id);
  service.push(1, { sessionId: id, speaker: 'ME', samples: packet() });
  repos.settings.update({ appleSpeechLocale: 'auto' });
  const switching = service.switchLanguage();
  await new Promise((resolve) => setTimeout(resolve, 50));
  // The new helpers are not ready yet, so their audio is dropped instead of failing the session.
  assert.equal(service.push(1, { sessionId: id, speaker: 'ME', samples: packet() }), true);
  await switching;
  assert.deepEqual(spawned.slice(2), [
    { session: id, speaker: 'ME', language: 'en-US', alternate: 'pt-BR' },
    { session: id, speaker: 'THEY', language: 'en-US', alternate: 'pt-BR' },
  ]);
  assert.equal(service.owns(1), true);
  service.push(1, { sessionId: id, speaker: 'ME', samples: packet() });
  const wav = require('../src/main/domain/audio/wav.cjs').wav(Buffer.from(packet()));
  assert.equal(service.pushSystem({ sessionId: id, bytes: Uint8Array.from(wav).buffer }), true);
  await service.stop(1);
  // The stopped helpers' text is not saved: only the new helpers' final lines are.
  assert.deepEqual(transcript(), [
    ['ME', 'final ME'],
    ['THEY', 'final THEY'],
  ]);
  assert.deepEqual(
    captions.filter((caption) => caption.error),
    [],
  );
});

test('saving the same language again keeps the running helpers', async (t) => {
  const { repos, id, spawned, service } = harness(t, { appleSpeechLocale: 'pt-BR' });
  await service.start(1, id);
  repos.settings.update({ appleSpeechLocale: 'pt-BR' });
  await service.switchLanguage();
  assert.equal(spawned.length, 1);
});

test('a change during startup applies once the session has started', async (t) => {
  let open;
  const gate = new Promise((resolve) => {
    open = resolve;
  });
  const { repos, id, spawned, service } = harness(
    t,
    { appleSpeechLocale: 'pt-BR' },
    {
      preflight: async (locale) => {
        await gate;
        return streams(['en-US', 'pt-BR'])(locale);
      },
    },
  );
  const starting = service.start(1, id);
  repos.settings.update({ appleSpeechLocale: 'auto' });
  const switching = service.switchLanguage();
  open();
  assert.equal(await starting, true);
  await switching;
  assert.deepEqual(
    spawned.map((item) => [item.language, item.alternate]),
    [
      ['pt-BR', null],
      ['en-US', 'pt-BR'],
    ],
  );
});

test('a language that cannot stream is a notice that keeps the running helpers and their captions', async (t) => {
  const { repos, id, spawned, captions, notices, service } = harness(
    t,
    { appleSpeechLocale: 'en-US' },
    { preflight: streams(['en-US', 'pt-BR']) },
  );
  await service.start(1, id);
  repos.settings.update({ appleSpeechLocale: 'es-ES' });
  await service.switchLanguage();
  assert.equal(spawned.length, 1);
  assert.deepEqual(notices, ['Streaming Apple Speech is unavailable for this language.']);
  // A caption error ends the recording in the window, so a rejected switch must not send one.
  assert.deepEqual(
    captions.filter((caption) => caption.error),
    [],
  );
  service.push(1, { sessionId: id, speaker: 'ME', samples: packet() });
  await service.stop(1);
  assert.equal(captions.at(-1).text, 'final ME', 'the old helper still captions the session');
});

test('a new helper that fails after the old ones stopped is the session caption error', async (t) => {
  const { repos, id, captions, notices, service } = harness(t, { appleSpeechLocale: 'en-US' });
  await service.start(1, id);
  service.spawn = (_executable, args, spawnOptions) =>
    spawn(process.execPath, [fixture, ...args, '--startup-error'], { stdio: spawnOptions.stdio });
  repos.settings.update({ appleSpeechLocale: 'pt-BR' });
  await service.switchLanguage();
  assert.deepEqual(notices, []);
  assert.deepEqual(
    captions.filter((caption) => caption.error).map((caption) => caption.error),
    ['Fixture language unavailable.'],
  );
});
