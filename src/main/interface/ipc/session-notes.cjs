const { text } = require('../../domain/shared/text.cjs');

// Session notes: save a stopped session's summary and handoff, open a saved note, and show or choose the folder.
function registerSessionNotes(handle, { requests, notes, picker, saveSettings }) {
  handle('notes:save', (event, input) => {
    const id = text(input?.requestId, 100),
      sessionId = text(input?.sessionId, 100);
    return requests.run({ id, owner: event.sender.id, sessionId, mode: 'sessionNote', timeoutMs: 120000 }, (signal) =>
      notes.save({ sessionId }, signal),
    );
  });
  handle('notes:open', (_event, path) => notes.open(text(path, 4000)));
  handle('notes:folder', () => notes.folder());
  handle('notes:choose-folder', async (event) => {
    const folder = await picker.pick(event.sender, 'notesFolder');
    if (folder) saveSettings({ sessionNotesFolder: folder });
    return notes.folder();
  });
}
module.exports = { registerSessionNotes };
