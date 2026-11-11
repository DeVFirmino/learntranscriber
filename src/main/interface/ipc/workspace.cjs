const { text } = require('../../domain/shared/text.cjs');

const FOLDERS = ['data', 'logs'];

const RENDERER_SHORTCUTS = ['ask', 'capture', 'record', 'toggleRecording', 'mic', 'previousInsight', 'nextInsight'];

// Workspace-wide channels: state, renderer-triggered shortcuts, local server discovery, history data,
// generation, the app's folders and the quit handshake. Clearing history, opening folders and confirming quit belong
// to the main window only.
function registerWorkspace(handle, { state, shortcuts, discover, history, folders, generate, callers, quit, errors }) {
  handle('shortcuts:dispatch', (_event, action) => {
    if (!RENDERER_SHORTCUTS.includes(action)) throw new Error('Unsupported action.');
    shortcuts.dispatch(action);
    return true;
  });
  handle('workspace:state', () => state());
  handle('local:discover', () => discover.localServers());
  handle('sessions:undo-compact', (_event, id) => history.undoCompaction(text(id, 100)));
  handle('data:stats', () => history.stats());
  handle('data:clear', (event) => {
    if (!callers.isMain(event)) throw new Error('Clear history from the main workspace.');
    return history.clear();
  });
  handle('data:reveal-folder', (event, name) => {
    if (!callers.isMain(event)) throw new Error('Open folders from the main workspace.');
    if (!FOLDERS.includes(name)) throw new Error('Unknown folder.');
    return folders.reveal(name);
  });
  handle('transcript:append', (_event, input) =>
    history.appendTranscript({ sessionId: input.sessionId, text: input.text, speaker: input.speaker }),
  );
  handle('ai:generate', (event, input) => generate(event, input));
  // An error a window showed is written to main.log; one from a window the user is not looking at is also shown in
  // the others, so a failure in the hidden workspace reaches the floating bar.
  handle('workspace:report-error', (event, input) => {
    // Kept short rather than refused, so a long message is still logged.
    const message = typeof input?.message === 'string' ? input.message.trim().slice(0, 500) : '';
    if (!message) return false;
    errors.log(message);
    if (input.forward === true) errors.forward(event.sender, message);
    return true;
  });
  handle('app:quit-ready', (event, input) => {
    if (callers.isMain(event))
      quit.ready({
        discardedSegments:
          Number.isInteger(input?.discardedSegments) && input.discardedSegments > 0 ? input.discardedSegments : 0,
      });
    return true;
  });
}
module.exports = { registerWorkspace };
