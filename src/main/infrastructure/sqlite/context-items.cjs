const { randomUUID } = require('node:crypto');
const { text } = require('../../domain/shared/text.cjs');

// Material attached to a session as prompt context: selections and screenshots' text.
function contextItemRepository({ db, sessions }) {
  return {
    add(sessionId, source, content) {
      sessions.get(sessionId);
      const id = randomUUID();
      db.prepare('INSERT INTO context_items VALUES (?,?,?,?,?)').run(
        id,
        sessionId,
        text(source, 200),
        text(content, 100000),
        new Date().toISOString(),
      );
      return id;
    },
  };
}
module.exports = { contextItemRepository };
