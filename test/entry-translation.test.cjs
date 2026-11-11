const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createEntryTranslation } = require('../src/main/application/sessions/entry-translation.cjs');

test('translates only participant messages and leaves the saved session untouched', async (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const session = repos.sessions.create('Conversation', 'general');
  const me = repos.entries.add(session.id, 'transcript', 'My answer', 'ME');
  const they = repos.entries.add(session.id, 'transcript', 'Their question', 'THEY');
  const before = repos.sessions.get(session.id);
  let checked = 0,
    called = 0;
  const service = createEntryTranslation({
    sessions: repos.sessions,
    providers: {
      checkContext: async (settings, messages) => {
        checked++;
        assert.equal(settings.model, 'translator');
        assert.equal(settings.generationFeature, 'translation');
        assert.equal(settings.generationConfig.temperature, 0);
        assert.match(messages[0].content, /Portuguese/);
        assert.equal(messages[1].content, 'Their question');
      },
      stream: async () => {
        called++;
        return '  A pergunta deles  ';
      },
    },
  });
  const signal = new AbortController().signal;
  await assert.rejects(
    service.translate({}, { sessionId: session.id, entryId: me.id, language: 'Portuguese' }, signal),
    /participant/,
  );
  await assert.rejects(
    service.translate({}, { sessionId: session.id, entryId: they.id, language: '' }, signal),
    /language/,
  );
  assert.deepEqual(
    await service.translate(
      { model: 'translator' },
      { sessionId: session.id, entryId: they.id, language: 'Portuguese' },
      signal,
    ),
    { entryId: they.id, language: 'Portuguese', text: 'A pergunta deles' },
  );
  assert.equal(checked, 1);
  assert.equal(called, 1);
  assert.deepEqual(repos.sessions.get(session.id), before);
});

test('preflight, cancellation and changed source prevent a returned translation', async (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const session = repos.sessions.create('Conversation', 'general');
  const entry = repos.entries.add(session.id, 'transcript', 'Original', 'THEY');
  const input = { sessionId: session.id, entryId: entry.id, language: 'English' };
  const signal = new AbortController().signal;
  let streams = 0;
  const preflight = createEntryTranslation({
    sessions: repos.sessions,
    providers: {
      checkContext: async () => {
        throw new Error('Context full');
      },
      stream: async () => {
        streams++;
      },
    },
  });
  await assert.rejects(preflight.translate({}, input, signal), /Context full/);
  assert.equal(streams, 0);
  const controller = new AbortController();
  const cancelled = createEntryTranslation({
    sessions: repos.sessions,
    providers: {
      checkContext: async () => {},
      stream: async () => {
        controller.abort();
        return 'Late answer';
      },
    },
  });
  await assert.rejects(cancelled.translate({}, input, controller.signal), { name: 'AbortError' });
  const changed = createEntryTranslation({
    sessions: repos.sessions,
    providers: {
      checkContext: async () => {},
      stream: async () => {
        repos.db.prepare('UPDATE entries SET content=? WHERE id=?').run('Changed', entry.id);
        return 'Stale answer';
      },
    },
  });
  await assert.rejects(changed.translate({}, input, signal), /changed/);
});
