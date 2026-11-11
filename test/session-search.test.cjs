const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');

test('FTS search safely handles literal punctuation and wildcard input', () => {
  const { db, sessions, entries, sessionSearch } = createRepositories(openDatabase(':memory:'));
  try {
    const s = sessions.create('100% complete', 'general');
    entries.add(s.id, 'transcript', 'A quote about queues', 'ME');
    assert.equal(sessionSearch.list('%').length, 1);
    assert.doesNotThrow(() => sessionSearch.list('" OR *'));
    assert.equal(sessionSearch.list('nonexistent').length, 0);
  } finally {
    db.close();
  }
});
test('history pages list every saved session newest start first, with stable totals and active exclusion', () => {
  const { db, sessions, entries, sessionSearch } = createRepositories(openDatabase(':memory:'));
  try {
    const ids = [];
    for (let index = 0; index < 45; index++) {
      const session = sessions.create(`Topic ${index}`, 'general');
      db.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(
        new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
        session.id,
      );
      sessions.update(session.id, { ended_at: new Date(Date.UTC(2026, 0, 2, 0, 45 - index)).toISOString() });
      ids.push(session.id);
    }
    const active = sessions.create('Current discussion', 'general');
    entries.add(ids[11], 'transcript', 'Distinctive retroactive keyword', 'THEY');
    const pages = [0, 20, 40].map((offset) => sessionSearch.page({ limit: 20, offset, excludeId: active.id }));
    assert.deepEqual(
      pages.map((page) => page.sessions.length),
      [20, 20, 5],
    );
    assert.deepEqual(
      pages.map((page) => page.total),
      [45, 45, 45],
    );
    assert.equal(new Set(pages.flatMap((page) => page.sessions.map((session) => session.id))).size, 45);
    assert.equal(pages[0].sessions[0].id, ids[44]);
    assert.equal(sessionSearch.page({ limit: 20, offset: 0 }).sessions[0].id, active.id);
    assert.equal(sessionSearch.page({ search: 'retroactive', excludeId: active.id }).sessions[0].id, ids[11]);
    assert.equal(sessionSearch.page({ search: '" OR *' }).total, 0);
    sessions.delete(ids[44]);
    assert.equal(sessionSearch.page({ limit: 20, offset: 40, excludeId: active.id }).sessions.length, 4);
  } finally {
    db.close();
  }
});
test('page rows count what was said and flag sessions still carrying the default title', () => {
  const { db, sessions, entries, sessionSearch } = createRepositories(openDatabase(':memory:'));
  try {
    const empty = sessions.create('Conversation · 11/2/2026', 'general');
    const spoken = sessions.create('Capital of Spain', 'general');
    entries.add(spoken.id, 'transcript', 'Madrid.', 'THEY');
    entries.add(spoken.id, 'user', 'And Portugal?');
    const rows = Object.fromEntries(sessionSearch.page({ limit: 10 }).sessions.map((row) => [row.id, row]));
    assert.deepEqual([rows[empty.id].entry_count, rows[empty.id].untitled], [0, true]);
    assert.deepEqual([rows[spoken.id].entry_count, rows[spoken.id].untitled], [2, false]);
  } finally {
    db.close();
  }
});
