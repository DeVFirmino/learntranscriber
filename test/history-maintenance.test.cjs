const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');

const EMPTY = { totalSessions: 0, totalMessages: 0, totalTranscriptions: 0, activeSessions: 0 };

test('history statistics and clearing remove only session history', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  const { db, history } = repos;
  try {
    assert.deepEqual(history.stats(), EMPTY);
    assert.deepEqual(history.clear(), { sessions: 0, messages: 0, transcriptions: 0 });
    const open = repos.sessions.create('Queue review', 'general'),
      closed = repos.sessions.create('Archive', 'general');
    repos.entries.add(open.id, 'transcript', 'A bounded queue absorbs bursts', 'THEY');
    repos.entries.add(open.id, 'user', 'What capacity?');
    repos.entries.add(closed.id, 'assistant', 'Use a bounded queue.');
    repos.contextItems.add(open.id, 'selection', 'queue notes');
    repos.sessions.update(closed.id, { ended_at: new Date().toISOString() });
    repos.settings.update({ overlayOpacity: 0.7 });
    repos.credentials.set('openai', Buffer.from('cipher'));
    assert.deepEqual(history.stats(), {
      totalSessions: 2,
      totalMessages: 2,
      totalTranscriptions: 1,
      activeSessions: 1,
    });
    assert.deepEqual(history.clear(), { sessions: 2, messages: 2, transcriptions: 1 });
    assert.deepEqual(history.stats(), EMPTY);
    assert.equal(repos.sessionSearch.list('bounded').length, 0);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM entries_fts WHERE entries_fts MATCH 'bounded'").get().count,
      0,
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM context_items').get().count, 0);
    assert.equal(repos.settings.read().overlayOpacity, 0.7);
    assert.equal(repos.credentials.status().openai, true);
    assert.ok(repos.assistants.all().some((item) => item.id === 'general'));
  } finally {
    db.close();
  }
});
test('a failed history clear rolls back every table', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    const session = repos.sessions.create('Rollback', 'general');
    repos.entries.add(session.id, 'user', 'Keep me');
    repos.db.exec(
      "CREATE TRIGGER block_session_delete BEFORE DELETE ON sessions BEGIN SELECT RAISE(ABORT,'blocked'); END;",
    );
    assert.throws(() => repos.history.clear(), /blocked/);
    assert.equal(repos.history.stats().totalMessages, 1);
    assert.equal(repos.sessionSearch.list('Keep').length, 1);
  } finally {
    repos.db.close();
  }
});
