const { randomUUID } = require('node:crypto');
const { text } = require('../../domain/shared/text.cjs');
const { sessionMetadata } = require('../../domain/sessions/rules.cjs');

const UPDATABLE = ['title', 'summary', 'translation', 'ended_at'];
const optional = (value) => (value === null || value === undefined || value === '' ? null : text(value, 200));

// One session with its entries, attached context and compaction state; the summary is written compare-and-set.
function sessionRepository({ db, settings, compactions }) {
  function get(id) {
    const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(id);
    if (!session) throw new Error('Session not found.');
    return {
      ...session,
      compaction: compactions.state(id),
      entries: db.prepare('SELECT * FROM entries WHERE session_id=? ORDER BY rowid').all(id),
      context: db.prepare('SELECT * FROM context_items WHERE session_id=? ORDER BY rowid').all(id),
    };
  }
  return {
    get,
    // Metadata the caller omits falls back to the current settings; an explicit null or empty value stays empty.
    create(title, assistantId, metadata = {}) {
      const assistant = db.prepare('SELECT id,name FROM assistants WHERE id=?').get(assistantId);
      if (!assistant) throw new Error('Choose an existing assistant.');
      const defaults = sessionMetadata(settings.read());
      const field = (key) => optional(Object.hasOwn(metadata, key) ? metadata[key] : defaults[key]);
      const id = randomUUID();
      db.prepare(
        'INSERT INTO sessions(id,title,assistant_id,started_at,provider,model,analysis_model_source,transcription_model,assistant_name) VALUES (?,?,?,?,?,?,?,?,?)',
      ).run(
        id,
        text(title || 'Untitled session', 200),
        assistantId,
        new Date().toISOString(),
        field('provider'),
        field('model'),
        field('analysisModelSource'),
        field('transcriptionModel'),
        assistant.name,
      );
      return get(id);
    },
    updateModel(id, metadata) {
      get(id);
      if (!metadata || typeof metadata !== 'object') throw new Error('Choose valid session model metadata.');
      db.prepare('UPDATE sessions SET provider=?,model=?,analysis_model_source=? WHERE id=?').run(
        optional(metadata.provider),
        optional(metadata.model),
        optional(metadata.analysisModelSource),
        id,
      );
      return get(id);
    },
    // Validates the whole patch first, then applies it as one statement.
    update(id, patch) {
      get(id);
      const fields = Object.entries(patch || {}).map(([key, value]) => {
        if (!UPDATABLE.includes(key)) throw new Error('Invalid session update.');
        if (value !== null && (typeof value !== 'string' || value.length > 200000))
          throw new Error('Invalid session value.');
        return [key, key === 'title' ? text(value, 120) : value];
      });
      if (fields.length)
        db.prepare(`UPDATE sessions SET ${fields.map(([key]) => `${key}=?`).join(',')} WHERE id=?`).run(
          ...fields.map(([, value]) => value),
          id,
        );
      return get(id);
    },
    updateSummary(id, summary, expectedSummary) {
      if (
        typeof summary !== 'string' ||
        summary.length > 200000 ||
        typeof expectedSummary !== 'string' ||
        expectedSummary.length > 200000
      )
        throw new Error('Invalid overview update.');
      const result = db
        .prepare('UPDATE sessions SET summary=? WHERE id=? AND summary=?')
        .run(summary.trim(), id, expectedSummary);
      if (!result.changes) {
        get(id);
        throw new Error('Overview changed in another window. Reload it or explicitly replace it.');
      }
      return get(id);
    },
    delete(id) {
      db.prepare('DELETE FROM sessions WHERE id=?').run(id);
    },
    // One statement, so the selection is deleted together or not at all.
    deleteMany(ids) {
      if (ids.length) db.prepare(`DELETE FROM sessions WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    },
    // Every open session except the live one ends at its last entry, or at its start when nothing was saved in it.
    // Returns how many were closed.
    closeLeftOpen(liveId = null) {
      return db
        .prepare(
          `UPDATE sessions SET ended_at=COALESCE((SELECT MAX(created_at) FROM entries WHERE entries.session_id=sessions.id), started_at)
          WHERE ended_at IS NULL AND id IS NOT ?`,
        )
        .run(liveId).changes;
    },
  };
}
module.exports = { sessionRepository };
