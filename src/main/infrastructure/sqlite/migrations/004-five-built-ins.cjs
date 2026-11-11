const { createHash } = require('node:crypto');

// The catalog went from eight built-ins to five. A stored copy of a dropped one that still matches what the seed wrote
// (its fingerprint below) is retired; an edited copy stays as the user's own assistant.
const DROPPED = {
  'system-design': 'd229d43a15eae0d0a768c22663194eb1a63e1e2efb0d06203269fce47807088c',
  leetcode: 'fb9276e73db1a9da32f98f433537bf0e96c081509674f1e41d75dba3505091ab',
  sales: '3c321a16f81d6cd8fa8e1c213c14900807fcbd3b3e9ea309b53045bdc6a70acf',
};

const fingerprint = (row) =>
  createHash('sha256')
    .update(
      JSON.stringify([row.name, row.prompt, row.category, row.realtime_prompt, row.follow_up_prompt, row.email_prompt]),
    )
    .digest('hex');

const untouched = (row, fingerprints) =>
  fingerprint(row) === fingerprints[row.id] &&
  !row.mcp_determination_prompt &&
  !row.mcp_interpretation_prompt &&
  !row.mcp_next_action_prompt &&
  !row.context &&
  !row.require_certainty &&
  (row.knowledge_files || '[]') === '[]' &&
  (row.mcp_servers || '[]') === '[]';

// Same shape the assistant repository archives, so sessions that used a retired assistant keep its prompt.
const snapshot = (row) =>
  JSON.stringify({
    ...row,
    require_certainty: Boolean(row.require_certainty),
    mcp_servers: JSON.parse(row.mcp_servers || '[]'),
    knowledge_files: JSON.parse(row.knowledge_files || '[]'),
  });

function up(db, fingerprints = DROPPED) {
  const ids = Object.keys(fingerprints);
  const rows = db.prepare(`SELECT * FROM assistants WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  for (const row of rows.filter((row) => untouched(row, fingerprints))) {
    if (db.prepare('SELECT 1 FROM sessions WHERE assistant_id=? LIMIT 1').get(row.id))
      db.prepare('INSERT OR REPLACE INTO archived_assistants(id,snapshot) VALUES (?,?)').run(row.id, snapshot(row));
    const selected = db.prepare("SELECT value FROM settings WHERE key='assistantId'").get();
    if (selected && JSON.parse(selected.value) === row.id)
      db.prepare("UPDATE settings SET value=? WHERE key='assistantId'").run(JSON.stringify('general'));
    db.prepare('DELETE FROM assistants WHERE id=?').run(row.id);
  }
}

module.exports = { version: 4, name: 'five-built-ins', up };
