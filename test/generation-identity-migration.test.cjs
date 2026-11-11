const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { transaction } = require('../src/main/infrastructure/sqlite/database.cjs');
const { migrate, MIGRATIONS } = require('../src/main/infrastructure/sqlite/migrations/index.cjs');

test('generation identity migration preserves legacy turns, summaries and search without inventing a mode', () => {
  const db = new DatabaseSync(':memory:');
  try {
    migrate(
      db,
      transaction,
      MIGRATIONS.filter((item) => item.version < 9),
    );
    db.exec(`INSERT INTO sessions(id,title,assistant_id,started_at,summary) VALUES ('s','Legacy','general','2026-01-01','Kept overview');
      INSERT INTO entries(id,session_id,kind,content,created_at) VALUES
      ('q','s','user','Unanswered question','2026-01-01'), ('a','s','assistant','Legacy response','2026-01-01');`);
    migrate(db, transaction);
    const rows = db.prepare('SELECT id,content,generation_mode,request_id FROM entries ORDER BY rowid').all();
    assert.deepEqual(
      rows.map((row) => ({ ...row })),
      [
        { id: 'q', content: 'Unanswered question', generation_mode: null, request_id: null },
        { id: 'a', content: 'Legacy response', generation_mode: null, request_id: null },
      ],
    );
    assert.equal(db.prepare('SELECT summary FROM sessions').get().summary, 'Kept overview');
    assert.equal(db.prepare("SELECT count(*) AS n FROM entries_fts WHERE entries_fts MATCH 'Legacy'").get().n, 1);
    migrate(db, transaction);
    assert.equal(db.prepare('SELECT count(*) AS n FROM entries').get().n, 2);
  } finally {
    db.close();
  }
});
