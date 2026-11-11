const { text } = require('../../domain/shared/text.cjs');
const { isDefaultTitle } = require('../../domain/sessions/session-title.cjs');

const likePattern = (value) => '%' + value.replace(/[\\%_]/g, '\\$&') + '%';
const ftsPhrase = (value) => '"' + value.replaceAll('"', '""') + '"';

// Finds sessions by title, summary or full-text entry match; the newest come first.
function sessionSearch({ db }) {
  return {
    list(query = '') {
      const phrase = String(query).trim().slice(0, 500);
      if (!phrase) return db.prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT 200').all();
      return db
        .prepare(
          `SELECT DISTINCT s.* FROM sessions s WHERE s.title LIKE ? ESCAPE '\\' OR s.summary LIKE ? ESCAPE '\\'
      OR s.id IN (SELECT e.session_id FROM entries_fts f JOIN entries e ON e.rowid=f.rowid WHERE entries_fts MATCH ?)
      ORDER BY s.started_at DESC LIMIT 200`,
        )
        .all(likePattern(phrase), likePattern(phrase), ftsPhrase(phrase));
    },
    // Open sessions first, then the most recently ended. With a scope, the search is passed to FTS5 as its own query
    // syntax; without one, it is matched as a literal phrase.
    page(options = {}) {
      if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new Error('Choose valid history page options.');
      const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(200, Math.trunc(options.limit))) : 20;
      const offset = Number.isFinite(options.offset) ? Math.max(0, Math.trunc(options.offset)) : 0;
      if (options.search !== undefined && typeof options.search !== 'string')
        throw new Error('History search must be text.');
      if (options.scope !== undefined && !['conversation', 'all'].includes(options.scope))
        throw new Error('Choose a valid history search scope.');
      const search = (options.search || '').trim().slice(0, 500);
      const predicates = [],
        parameters = [];
      if (options.excludeId) {
        predicates.push('s.id <> ?');
        parameters.push(text(options.excludeId, 100));
      }
      if (search) {
        predicates.push(
          `(LOWER(s.title) LIKE ? ESCAPE '\\' OR LOWER(s.summary) LIKE ? ESCAPE '\\' OR s.id IN (SELECT e.session_id FROM entries_fts f JOIN entries e ON e.rowid=f.rowid WHERE entries_fts MATCH ?${options.scope === 'conversation' ? " AND e.kind <> 'transcript'" : ''}))`,
        );
        const escaped = options.scope ? '%' + search.toLowerCase() + '%' : likePattern(search.toLowerCase());
        parameters.push(escaped, escaped, options.scope ? search : ftsPhrase(search));
      }
      const where = predicates.length ? ' WHERE ' + predicates.join(' AND ') : '';
      try {
        const total = db.prepare(`SELECT COUNT(*) AS total FROM sessions s${where}`).get(...parameters).total;
        // Newest start first, so the library's day groups follow the calendar. Each row says how much was said and
        // whether it still carries the default title, so a card can show an empty or untitled session as such.
        const sessions = db
          .prepare(
            `SELECT s.*, (SELECT COUNT(*) FROM entries e WHERE e.session_id=s.id AND e.kind IN ('transcript','user','assistant')) AS entry_count FROM sessions s${where} ORDER BY (s.ended_at IS NULL) DESC, s.started_at DESC, s.id DESC LIMIT ? OFFSET ?`,
          )
          .all(...parameters, limit, offset)
          .map((row) => ({ ...row, untitled: isDefaultTitle(row.title) }));
        return { sessions, total, limit, offset };
      } catch (error) {
        if (search && options.scope && /fts5|syntax error|unterminated|no such column/i.test(error.message))
          throw new Error('Invalid history search. Check quotes and search operators.');
        throw error;
      }
    },
  };
}
module.exports = { sessionSearch };
