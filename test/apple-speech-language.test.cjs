const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { AppleSpeechSessions } = require('../src/main/infrastructure/native/apple-speech-sessions.cjs');

const fixture = path.join(__dirname, 'fixtures/apple-session-helper.cjs');
const value = (args, name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const streams = (supported) => async (locale) => ({
  authorization: 'authorized',
  supportsStreamingRecognition: supported.includes(locale),
});

// A service over the fixture helper that records each spawn's languages.
function harness(t, settings, options = {}) {
  const repos = createRepositories(openDatabase(':memory:'));
  repos.settings.update({ transcriptionProvider: 'apple', liveTranscription: true, ...settings });
  const id = repos.sessions.create('Class', 'general').id;
  const spawned = [],
    captions = [],
    readyLocales = [];
  const service = new AppleSpeechSessions(repos, '/fixture/helper', (caption) => captions.push(caption), {
    spawn: (_executable, args, spawnOptions) => {
      spawned.push({
        session: value(args, '--session-id'),
        speaker: value(args, '--speaker-label'),
        language: value(args, '--language'),
        alternate: value(args, '--alternate-language'),
      });
      return spawn(process.execPath, [fixture, ...args], { stdio: spawnOptions.stdio });
    },
    preflight: options.preflight,
    onReady: (locale) => readyLocales.push(locale),
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
  return { repos, id, spawned, captions, readyLocales, service, transcript };
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
