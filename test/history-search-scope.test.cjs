const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');

test('history page can match the conversation search scope while keeping explicit transcript search', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    const title = repos.sessions.create('Needle title', 'general');
    const overview = repos.sessions.create('Overview source', 'general');
    repos.sessions.update(overview.id, { summary: 'Needle summary' });
    const chat = repos.sessions.create('Chat source', 'general');
    repos.entries.add(chat.id, 'user', 'Needle chat');
    const speech = repos.sessions.create('Speech source', 'general');
    repos.entries.add(speech.id, 'transcript', 'Needle speech', 'THEY');
    const ids = (options) =>
      repos.sessionSearch
        .page(options)
        .sessions.map((item) => item.id)
        .sort();
    assert.deepEqual(ids({ search: 'needle', scope: 'conversation' }), [title.id, overview.id, chat.id].sort());
    assert.deepEqual(ids({ search: 'needle', scope: 'all' }), [title.id, overview.id, chat.id, speech.id].sort());
    assert.deepEqual(ids({ search: 'chat OR speech', scope: 'conversation' }), [chat.id]);
    assert.deepEqual(ids({ search: 'chat OR speech', scope: 'all' }), [chat.id, speech.id].sort());
    assert.deepEqual(ids({ search: 'Needle speech' }), [speech.id], 'legacy callers retain broad literal search');
    const page = repos.sessionSearch.page({ search: 'needle', scope: 'all', excludeId: speech.id, limit: 2 });
    assert.equal(page.total, 3);
    assert.equal(page.sessions.length, 2);
    assert.ok(page.sessions.every((item) => item.id !== speech.id));
  } finally {
    repos.db.close();
  }
});

test('malformed expressions return a readable error without changing session history', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    const session = repos.sessions.create('History fixture', 'general');
    repos.entries.add(session.id, 'assistant', 'Stored answer');
    const before = repos.sessions.get(session.id);
    assert.throws(
      () => repos.sessionSearch.page({ search: '"unterminated', scope: 'conversation' }),
      /Invalid history search/,
    );
    assert.throws(() => repos.sessionSearch.page({ scope: 'invalid' }), /valid history search scope/);
    assert.deepEqual(repos.sessions.get(session.id), before);
  } finally {
    repos.db.close();
  }
});
