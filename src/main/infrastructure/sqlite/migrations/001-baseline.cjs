// The schema as it stood before versioned migrations. Every step is idempotent, so a database created by an
// earlier build (user_version 0) converges on it without losing data.
const TABLES = `
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS credentials (provider TEXT PRIMARY KEY, ciphertext BLOB NOT NULL);
  CREATE TABLE IF NOT EXISTS assistants (id TEXT PRIMARY KEY, name TEXT NOT NULL, prompt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS archived_assistants (id TEXT PRIMARY KEY, snapshot TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL, assistant_id TEXT NOT NULL,
    started_at TEXT NOT NULL, ended_at TEXT, summary TEXT NOT NULL DEFAULT '', translation TEXT NOT NULL DEFAULT '',
    provider TEXT, model TEXT, analysis_model_source TEXT, transcription_model TEXT, assistant_name TEXT);
  CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('transcript','user','assistant')), speaker TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(content, content='entries', content_rowid='rowid');
  CREATE TRIGGER IF NOT EXISTS entries_insert AFTER INSERT ON entries BEGIN
    INSERT INTO entries_fts(rowid, content) VALUES (new.rowid, new.content); END;
  CREATE TRIGGER IF NOT EXISTS entries_delete AFTER DELETE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, content) VALUES ('delete', old.rowid, old.content); END;
  CREATE INDEX IF NOT EXISTS entries_session ON entries(session_id, created_at);
  CREATE TABLE IF NOT EXISTS session_compactions(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,content TEXT NOT NULL,through_rowid INTEGER NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS transcript_compactions(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,content TEXT NOT NULL,through_rowid INTEGER NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS connectors(id TEXT PRIMARY KEY,name TEXT NOT NULL,endpoint TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS document_references(id TEXT PRIMARY KEY,connector_id TEXT NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,endpoint TEXT NOT NULL,provider TEXT NOT NULL,external_id TEXT NOT NULL,title TEXT NOT NULL,url TEXT NOT NULL,status TEXT NOT NULL,last_used_at TEXT,UNIQUE(connector_id,endpoint,external_id));
  CREATE TABLE IF NOT EXISTS summary_deliveries(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,target TEXT NOT NULL,digest TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,error TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(session_id,target,digest));
  CREATE TABLE IF NOT EXISTS email_deliveries(id TEXT PRIMARY KEY,session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,account_id TEXT NOT NULL,digest TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,status TEXT NOT NULL,error TEXT NOT NULL,accepted TEXT NOT NULL,rejected TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS connector_secrets(id TEXT PRIMARY KEY REFERENCES connectors(id) ON DELETE CASCADE,ciphertext BLOB NOT NULL);
  CREATE TABLE IF NOT EXISTS connector_oauth(id TEXT PRIMARY KEY REFERENCES connectors(id) ON DELETE CASCADE,ciphertext BLOB NOT NULL);
  CREATE TABLE IF NOT EXISTS context_items(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,source TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS handoffs(id TEXT PRIMARY KEY,title TEXT NOT NULL,context TEXT NOT NULL,assistant_name TEXT NOT NULL,assistant_prompt TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL);
`;

// Columns added after their table first shipped, in the order earlier builds added them.
const ADDED_COLUMNS = {
  assistants: {
    category: "TEXT NOT NULL DEFAULT 'Uncategorized'",
    realtime_prompt: "TEXT NOT NULL DEFAULT ''",
    follow_up_prompt: "TEXT NOT NULL DEFAULT ''",
    email_prompt: "TEXT NOT NULL DEFAULT ''",
    mcp_determination_prompt: "TEXT NOT NULL DEFAULT ''",
    mcp_interpretation_prompt: "TEXT NOT NULL DEFAULT ''",
    mcp_next_action_prompt: "TEXT NOT NULL DEFAULT ''",
    context: "TEXT NOT NULL DEFAULT ''",
    require_certainty: 'INTEGER NOT NULL DEFAULT 0',
    mcp_servers: "TEXT NOT NULL DEFAULT '[]'",
    knowledge_files: "TEXT NOT NULL DEFAULT '[]'",
  },
  sessions: {
    provider: 'TEXT',
    model: 'TEXT',
    analysis_model_source: 'TEXT',
    transcription_model: 'TEXT',
    assistant_name: 'TEXT',
  },
  session_compactions: { observed_through_rowid: 'INTEGER' },
  entries: { segment_id: 'TEXT' },
};

// Built-in assistants that predate the category column get their categories once it is added.
const BUILT_IN_CATEGORIES = [
  ['general', 'General'],
  ['study', 'Education'],
  ['meeting', 'Meetings'],
];

const columnsOf = (db, table) =>
  new Set(
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((column) => column.name),
  );

function up(db) {
  db.exec(TABLES);
  const hadCategory = columnsOf(db, 'assistants').has('category');
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    const existing = columnsOf(db, table);
    for (const [name, definition] of Object.entries(columns))
      if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS entries_segment ON entries(session_id,segment_id) WHERE segment_id IS NOT NULL',
  );
  if (!hadCategory)
    for (const [id, category] of BUILT_IN_CATEGORIES)
      db.prepare('UPDATE assistants SET category=? WHERE id=?').run(category, id);
}

module.exports = { version: 1, name: 'baseline', up };
