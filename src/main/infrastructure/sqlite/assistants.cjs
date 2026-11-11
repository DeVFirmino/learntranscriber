const { assertAvailableName, availableName } = require('../../domain/assistants/names.cjs');
const { randomUUID } = require('node:crypto');
const { normalizeAssistant } = require('../../domain/assistants/rules.cjs');
const { BUILT_IN_ASSISTANTS, BUILT_IN_IDS } = require('../../domain/assistants/built-in-catalog.cjs');
const { selectionAfterDelete } = require('../../domain/assistants/deletion.cjs');

// Inserts any missing built-in assistant by id, except the ones the user deleted; a stored one, edited or not, is
// never overwritten.
function seedBuiltInAssistants(db) {
  const dismissed = new Set(
    db
      .prepare('SELECT id FROM dismissed_built_ins')
      .all()
      .map((row) => row.id),
  );
  insertBuiltIns(
    db,
    BUILT_IN_IDS.filter((id) => !dismissed.has(id)),
  );
}

function insertBuiltIns(db, ids) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO assistants(id,name,prompt,category,realtime_prompt,follow_up_prompt,email_prompt) VALUES (?,?,?,?,?,?,?)',
  );
  for (const a of BUILT_IN_ASSISTANTS.filter((item) => ids.includes(item.id))) {
    const library = db.prepare('SELECT id, name FROM assistants').all();
    if (library.some((item) => item.id === a.id)) continue;
    insert.run(
      a.id,
      availableName(a.name, library),
      a.prompt,
      a.category,
      a.realtimePrompt,
      a.followUpPrompt,
      a.emailPrompt,
    );
  }
}

const SAVE = `INSERT INTO assistants(id,name,prompt,category,realtime_prompt,follow_up_prompt,email_prompt,context,require_certainty,knowledge_files)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,prompt=excluded.prompt,category=excluded.category,realtime_prompt=excluded.realtime_prompt,follow_up_prompt=excluded.follow_up_prompt,email_prompt=excluded.email_prompt,context=excluded.context,require_certainty=excluded.require_certainty,knowledge_files=excluded.knowledge_files`;

// The assistant library. A deleted assistant that sessions still name is archived, so history keeps its prompt.
function assistantRepository({ db, transaction, settings }) {
  const all = () =>
    db
      .prepare('SELECT * FROM assistants ORDER BY name')
      .all()
      .map((item) => ({
        ...item,
        require_certainty: Boolean(item.require_certainty),
        knowledge_files: JSON.parse(item.knowledge_files || '[]'),
      }));
  return {
    all,
    forSession(id) {
      const active = all().find((item) => item.id === id);
      if (active) return active;
      const archived = db.prepare('SELECT snapshot FROM archived_assistants WHERE id=?').get(id);
      return archived ? JSON.parse(archived.snapshot) : null;
    },
    save(input) {
      const a = normalizeAssistant(input, {
        newId: randomUUID,
        savedKnowledgeFiles: (id) => all().find((item) => item.id === id)?.knowledge_files,
      });
      assertAvailableName(a.name, a.id, all());
      db.prepare(SAVE).run(
        a.id,
        a.name,
        a.prompt,
        a.category,
        a.realtimePrompt,
        a.followUpPrompt,
        a.emailPrompt,
        a.context,
        a.requireCertainty ? 1 : 0,
        JSON.stringify(a.knowledgeFiles),
      );
      return a.id;
    },
    // A deleted built-in comes back with its catalog content and is no longer remembered as deleted.
    restoreBuiltIns(ids) {
      transaction(db, () => {
        const remove = db.prepare('DELETE FROM dismissed_built_ins WHERE id=?');
        for (const id of ids) remove.run(id);
        insertBuiltIns(db, ids);
      });
    },
    // Archiving, moving the selection, remembering a deleted built-in and deleting commit together.
    delete(id) {
      if (typeof id !== 'string' || !id || id.length > 100) throw new Error('Choose an assistant to delete.');
      return transaction(db, () => {
        const library = all();
        const assistant = library.find((item) => item.id === id);
        if (!assistant) throw new Error('Assistant not found.');
        const selected = settings.read().assistantId;
        const selectedAssistantId = selectionAfterDelete({
          remainingIds: library.filter((item) => item.id !== id).map((item) => item.id),
          selectedId: selected,
          deletedId: id,
        });
        if (db.prepare('SELECT 1 FROM sessions WHERE assistant_id=? LIMIT 1').get(id))
          db.prepare('INSERT OR REPLACE INTO archived_assistants(id,snapshot) VALUES (?,?)').run(
            id,
            JSON.stringify(assistant),
          );
        if (selectedAssistantId !== selected)
          db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)').run(
            'assistantId',
            JSON.stringify(selectedAssistantId),
          );
        if (BUILT_IN_IDS.includes(id)) db.prepare('INSERT OR IGNORE INTO dismissed_built_ins(id) VALUES (?)').run(id);
        db.prepare('DELETE FROM assistants WHERE id=?').run(id);
        return { selectedAssistantId };
      });
    },
  };
}
module.exports = { assistantRepository, seedBuiltInAssistants };
