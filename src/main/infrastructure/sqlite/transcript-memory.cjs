function transcriptMemoryRepository({ db, transaction }) {
  const latest = (id) =>
    db.prepare('SELECT * FROM transcript_compactions WHERE session_id=? ORDER BY rowid DESC LIMIT 1').get(id) || null;
  return {
    snapshot(id) {
      const current = latest(id);
      const entries = db
        .prepare(
          "SELECT rowid AS sequence,* FROM entries WHERE session_id=? AND kind='transcript' AND rowid>? ORDER BY rowid",
        )
        .all(id, current?.through_rowid || 0);
      const total = db
        .prepare("SELECT COUNT(*) AS count FROM entries WHERE session_id=? AND kind='transcript'")
        .get(id).count;
      return { current, entries, total };
    },
    commit(id, { expectedId, summary, throughRowid, newId, at }) {
      transaction(db, () => {
        if ((latest(id)?.id || null) !== expectedId) throw new Error('Transcript memory changed during compaction.');
        db.prepare(
          'INSERT INTO transcript_compactions(id,session_id,content,through_rowid,created_at) VALUES (?,?,?,?,?)',
        ).run(newId, id, summary, throughRowid, at);
      });
    },
  };
}
module.exports = { transcriptMemoryRepository };
