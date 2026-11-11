const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');

function fixture(t) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const session = repos.sessions.create('Decisions', 'general');
  for (let i = 0; i < 10; i++)
    repos.entries.add(session.id, 'transcript', `Decision number ${i} about queues.`, 'THEY');
  return { repos, id: session.id, compactions: repos.compactions };
}

test('a checkpoint hides compacted entries from the prompt but keeps full-text history', (t) => {
  const { repos, id, compactions } = fixture(t);
  const { entries } = compactions.snapshot(id);
  compactions.commit(id, {
    expectedId: null,
    summary: 'Queues were chosen.',
    throughRowid: entries[3].sequence,
    at: '2026-10-24T12:00:00.000Z',
    newId: 'c1',
  });
  const after = compactions.snapshot(id);
  assert.equal(after.current.id, 'c1');
  assert.deepEqual(
    after.entries.map((e) => e.sequence),
    entries.slice(4).map((e) => e.sequence),
  );
  assert.deepEqual(compactions.state(id).summary, 'Queues were chosen.');
  assert.equal(compactions.state(id).count, 1);
  assert.equal(repos.sessionSearch.list('number').length, 1);
  assert.equal(repos.sessions.get(id).entries.length, 10);
});

test('a commit against a stale checkpoint is refused and writes nothing', (t) => {
  const { id, compactions } = fixture(t);
  const cutoff = compactions.snapshot(id).entries[1].sequence;
  compactions.commit(id, {
    expectedId: null,
    summary: 'First.',
    throughRowid: cutoff,
    at: '2026-10-24T12:00:00.000Z',
    newId: 'c1',
  });
  assert.throws(
    () =>
      compactions.commit(id, {
        expectedId: null,
        summary: 'Racing.',
        throughRowid: cutoff,
        at: '2026-10-24T12:00:01.000Z',
        newId: 'c2',
      }),
    /Session memory changed/,
  );
  assert.equal(compactions.state(id).count, 1);
  assert.equal(compactions.state(id).summary, 'First.');
});

test('undo removes only the latest checkpoint and restores its entries', (t) => {
  const { id, compactions } = fixture(t);
  const entries = compactions.snapshot(id).entries;
  compactions.commit(id, {
    expectedId: null,
    summary: 'First.',
    throughRowid: entries[1].sequence,
    at: '2026-10-24T12:00:00.000Z',
    newId: 'c1',
  });
  compactions.commit(id, {
    expectedId: 'c1',
    summary: 'Second.',
    throughRowid: entries[4].sequence,
    at: '2026-10-24T12:00:01.000Z',
    newId: 'c2',
  });
  compactions.undoLatest(id);
  assert.equal(compactions.snapshot(id).current.id, 'c1');
  assert.equal(compactions.snapshot(id).entries.length, 8);
});

test('an existing checkpoint database gains the observation boundary without changing history or undo', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'compaction-migration-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'workspace.sqlite');
  const original = createRepositories(openDatabase(file));
  const id = original.sessions.create('Migration', 'general').id;
  original.entries.add(id, 'user', 'Original fact.');
  const repo = original.compactions;
  repo.commit(id, {
    expectedId: null,
    summary: 'Fact.',
    throughRowid: 1,
    at: '2026-10-30T12:00:00.000Z',
    newId: 'old',
  });
  // A database from before versioned migrations: no observation column and user_version 0.
  original.db.exec('ALTER TABLE session_compactions DROP COLUMN observed_through_rowid; PRAGMA user_version=0');
  original.db.close();
  const repos = createRepositories(openDatabase(file));
  t.after(() => repos.db.close());
  const migrated = repos.compactions;
  assert.equal(migrated.snapshot(id).current.observed_through_rowid, null);
  assert.equal(migrated.state(id).summary, 'Fact.');
  assert.equal(repos.sessions.get(id).entries[0].content, 'Original fact.');
  migrated.undoLatest(id);
  assert.equal(migrated.snapshot(id).entries.length, 1);
});
