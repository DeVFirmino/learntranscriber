const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { openDatabase, transaction } = require('../src/main/infrastructure/sqlite/database.cjs');
const { migrate, LATEST_VERSION } = require('../src/main/infrastructure/sqlite/migrations/index.cjs');

const TABLES = [
  'settings',
  'credentials',
  'assistants',
  'archived_assistants',
  'sessions',
  'entries',
  'entries_fts',
  'session_compactions',
  'transcript_compactions',
  'context_items',
  'dismissed_built_ins',
];
const version = (db) => db.prepare('PRAGMA user_version').get().user_version;
const columns = (db, table) =>
  db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((column) => column.name);
const schemaNames = (db, type) =>
  db
    .prepare('SELECT name FROM sqlite_master WHERE type=?')
    .all(type)
    .map((row) => row.name);

test('a fresh database ends at the latest version with every table, trigger and index', () => {
  const db = openDatabase(':memory:');
  try {
    assert.equal(version(db), LATEST_VERSION);
    const tables = new Set(schemaNames(db, 'table'));
    for (const table of TABLES) assert.ok(tables.has(table), table);
    assert.deepEqual(schemaNames(db, 'trigger').sort(), ['entries_delete', 'entries_insert']);
    for (const index of ['entries_session', 'entries_segment']) assert.ok(schemaNames(db, 'index').includes(index));
    assert.ok(columns(db, 'assistants').includes('knowledge_files'));
    assert.ok(columns(db, 'entries').includes('segment_id'));
  } finally {
    db.close();
  }
});

test('a database shaped before the added columns gains them and keeps its rows', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE assistants (id TEXT PRIMARY KEY, name TEXT NOT NULL, prompt TEXT NOT NULL);
      CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL, assistant_id TEXT NOT NULL,
        started_at TEXT NOT NULL, ended_at TEXT, summary TEXT NOT NULL DEFAULT '', translation TEXT NOT NULL DEFAULT '');
      CREATE TABLE entries (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('transcript','user','assistant')), speaker TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE session_compactions(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,content TEXT NOT NULL,through_rowid INTEGER NOT NULL,created_at TEXT NOT NULL);
      INSERT INTO assistants VALUES ('general','General assistant','Help.'),('custom','Custom','Mine.');
      INSERT INTO sessions(id,title,assistant_id,started_at) VALUES ('s1','Kept','general','2026-01-01T00:00:00.000Z');
      INSERT INTO entries VALUES ('e1','s1','transcript','THEY','Still here','2026-01-01T00:00:01.000Z');
    `);
    assert.equal(migrate(db, transaction), LATEST_VERSION);
    for (const name of ['category', 'realtime_prompt', 'require_certainty', 'knowledge_files'])
      assert.ok(columns(db, 'assistants').includes(name), name);
    assert.equal(columns(db, 'assistants').includes('mcp_servers'), false);
    for (const name of ['provider', 'model', 'analysis_model_source', 'transcription_model', 'assistant_name'])
      assert.ok(columns(db, 'sessions').includes(name), name);
    assert.ok(columns(db, 'session_compactions').includes('observed_through_rowid'));
    assert.ok(columns(db, 'entries').includes('segment_id'));
    const categories = Object.fromEntries(
      db
        .prepare('SELECT id,category FROM assistants')
        .all()
        .map((row) => [row.id, row.category]),
    );
    assert.deepEqual(categories, { general: 'General', custom: 'Uncategorized' });
    assert.equal(db.prepare('SELECT title FROM sessions').get().title, 'Kept');
    assert.equal(db.prepare('SELECT content FROM entries').get().content, 'Still here');
  } finally {
    db.close();
  }
});

test('the connections migration drops their tables, the assistant tool columns and their settings', () => {
  const db = openDatabase(':memory:');
  try {
    db.exec('PRAGMA user_version=4');
    db.exec(`
      CREATE TABLE connectors(id TEXT PRIMARY KEY,name TEXT NOT NULL,endpoint TEXT NOT NULL);
      CREATE TABLE handoffs(id TEXT PRIMARY KEY,title TEXT NOT NULL);
      ALTER TABLE assistants ADD COLUMN mcp_servers TEXT NOT NULL DEFAULT '[]';
      INSERT INTO connectors VALUES ('c1','Notes','http://127.0.0.1:9/mcp');
      INSERT INTO settings VALUES ('handoffEnabled','true'),('autoScroll','false');
    `);
    assert.equal(migrate(db, transaction), LATEST_VERSION);
    const tables = new Set(schemaNames(db, 'table'));
    for (const table of ['connectors', 'handoffs', 'document_references', 'summary_deliveries'])
      assert.equal(tables.has(table), false, table);
    assert.equal(columns(db, 'assistants').includes('mcp_servers'), false);
    assert.deepEqual(
      db
        .prepare('SELECT key FROM settings')
        .all()
        .map((row) => row.key),
      ['autoScroll'],
    );
  } finally {
    db.close();
  }
});

test('the email migration drops sent-summary records and the sealed mail account', () => {
  const db = openDatabase(':memory:');
  try {
    db.exec('PRAGMA user_version=5');
    db.exec(`
      CREATE TABLE email_deliveries(id TEXT PRIMARY KEY);
      INSERT INTO credentials VALUES ('smtp', x'00'), ('openai', x'01');
    `);
    assert.equal(migrate(db, transaction), LATEST_VERSION);
    assert.equal(new Set(schemaNames(db, 'table')).has('email_deliveries'), false);
    assert.deepEqual(
      db
        .prepare('SELECT provider FROM credentials')
        .all()
        .map((row) => row.provider),
      ['openai'],
    );
  } finally {
    db.close();
  }
});

test('applied migrations do not run again', () => {
  const db = new DatabaseSync(':memory:');
  try {
    let runs = 0;
    const migrations = [{ version: 1, up: () => runs++ }];
    migrate(db, transaction, migrations);
    migrate(db, transaction, migrations);
    assert.equal(runs, 1);
    assert.equal(version(db), 1);
    migrate(db, transaction, [...migrations, { version: 2, up: () => runs++ }]);
    assert.equal(runs, 2);
    assert.equal(version(db), 2);
  } finally {
    db.close();
  }
});

test('a failing migration rolls back its writes and leaves the version unchanged', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const migrations = [
      { version: 1, up: (connection) => connection.exec('CREATE TABLE first(id TEXT)') },
      {
        version: 2,
        up(connection) {
          connection.exec('CREATE TABLE second(id TEXT)');
          throw new Error('broken migration');
        },
      },
    ];
    assert.throws(() => migrate(db, transaction, migrations), /broken migration/);
    assert.equal(version(db), 1);
    assert.deepEqual(schemaNames(db, 'table'), ['first']);
  } finally {
    db.close();
  }
});
