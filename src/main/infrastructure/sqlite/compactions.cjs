const { compactionState } = require('../../domain/sessions/compaction.cjs');

const LATEST = 'SELECT * FROM session_compactions WHERE session_id=? ORDER BY rowid DESC LIMIT 1';

// Checkpoints are ordered by rowid; entries after the latest checkpoint's cutoff are the uncompacted remainder.
// Full-text history is untouched: a checkpoint only changes what the prompt sees.
function compactionRepository({ db, transaction }) {
  function snapshot(id) {
    const current = db.prepare(LATEST).get(id) || null;
    const entries = db
      .prepare('SELECT rowid AS sequence,* FROM entries WHERE session_id=? AND rowid>? ORDER BY rowid')
      .all(id, current?.through_rowid || 0);
    return { current, entries };
  }
  return {
    snapshot,
    state(id) {
      return compactionState({
        ...snapshot(id),
        count: db.prepare('SELECT COUNT(*) AS count FROM session_compactions WHERE session_id=?').get(id).count,
      });
    },
    // Commits only if no other checkpoint landed since `expectedId` was read.
    commit(id, { expectedId, summary, throughRowid, observedThroughRowid = null, at, newId }) {
      transaction(db, () => {
        const latest = db.prepare(LATEST).get(id) || null;
        if ((latest?.id || null) !== expectedId) throw new Error('Session memory changed; retry compaction.');
        db.prepare(
          'INSERT INTO session_compactions(id,session_id,content,through_rowid,created_at,observed_through_rowid) VALUES (?,?,?,?,?,?)',
        ).run(newId, id, summary, throughRowid, at, observedThroughRowid);
      });
    },
    undoLatest(id) {
      db.prepare(
        'DELETE FROM session_compactions WHERE id=(SELECT id FROM session_compactions WHERE session_id=? ORDER BY rowid DESC LIMIT 1)',
      ).run(id);
    },
  };
}
module.exports = { compactionRepository };
