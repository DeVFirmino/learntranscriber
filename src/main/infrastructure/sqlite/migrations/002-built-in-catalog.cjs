const { LEGACY_DEFAULTS, legacyUpgrade } = require('../../../domain/assistants/built-in-catalog.cjs');

const REPLACE =
  'UPDATE assistants SET name=?,prompt=?,category=?,realtime_prompt=?,follow_up_prompt=?,email_prompt=? WHERE id=?';

// The archive keeps the shape the assistant repository reads back for historical sessions.
const snapshot = (row) =>
  JSON.stringify({
    ...row,
    require_certainty: Boolean(row.require_certainty),
    mcp_servers: JSON.parse(row.mcp_servers || '[]'),
    knowledge_files: JSON.parse(row.knowledge_files || '[]'),
  });

function retire(db, row) {
  if (db.prepare('SELECT 1 FROM sessions WHERE assistant_id=? LIMIT 1').get(row.id))
    db.prepare('INSERT OR REPLACE INTO archived_assistants(id,snapshot) VALUES (?,?)').run(row.id, snapshot(row));
  const selected = db.prepare("SELECT value FROM settings WHERE key='assistantId'").get();
  if (selected && JSON.parse(selected.value) === row.id)
    db.prepare("UPDATE settings SET value=? WHERE key='assistantId'").run(JSON.stringify('general'));
  db.prepare('DELETE FROM assistants WHERE id=?').run(row.id);
}

// Preserve user edits and custom assistants while upgrading untouched legacy built-ins.
// The catalog's new assistants are inserted by the seed that runs after migrations.
function up(db) {
  const ids = Object.keys(LEGACY_DEFAULTS);
  const rows = db.prepare(`SELECT * FROM assistants WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  for (const row of rows) {
    const upgrade = legacyUpgrade(row);
    if (upgrade.action === 'retire') retire(db, row);
    if (upgrade.action !== 'replace') continue;
    const a = upgrade.assistant;
    db.prepare(REPLACE).run(a.name, a.prompt, a.category, a.realtimePrompt, a.followUpPrompt, a.emailPrompt, a.id);
  }
}

module.exports = { version: 2, name: 'built-in-catalog', up };
