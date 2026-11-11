const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerSessionNotes } = require('../src/main/interface/ipc/session-notes.cjs');

test('the note folder picker persists a choice and preserves the folder when cancelled', async () => {
  const handlers = {},
    saved = [],
    sender = { id: 1 };
  let chosen = '/tmp/notes',
    folder = '/tmp/default';
  registerSessionNotes(
    (name, handler) => {
      handlers[name] = handler;
    },
    {
      requests: {},
      notes: { folder: () => folder },
      picker: {
        pick: async (owner, kind) => {
          assert.equal(owner, sender);
          assert.equal(kind, 'notesFolder');
          return chosen;
        },
      },
      saveSettings: (patch) => {
        saved.push(patch);
        folder = patch.sessionNotesFolder;
      },
    },
  );
  assert.equal(await handlers['notes:choose-folder']({ sender }), '/tmp/notes');
  assert.deepEqual(saved, [{ sessionNotesFolder: '/tmp/notes' }]);
  chosen = null;
  assert.equal(await handlers['notes:choose-folder']({ sender }), '/tmp/notes');
  assert.equal(saved.length, 1);
});
