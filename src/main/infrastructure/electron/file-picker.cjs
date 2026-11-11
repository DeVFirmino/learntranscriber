const PICKS = {
  llmServer: { title: 'Choose llama-server', properties: ['openFile'] },
  whisperServer: { title: 'Choose whisper-server', properties: ['openFile'] },
  llmModel: {
    title: 'Import local model',
    properties: ['openFile'],
    filters: [{ name: 'Model', extensions: ['gguf'] }],
  },
  whisperModel: {
    title: 'Import local model',
    properties: ['openFile'],
    filters: [{ name: 'Model', extensions: ['bin'] }],
  },
  notesFolder: { title: 'Choose the session notes folder', properties: ['openDirectory', 'createDirectory'] },
  projector: {
    title: 'Import GGUF vision projector',
    properties: ['openFile'],
    filters: [{ name: 'GGUF vision projector', extensions: ['gguf'] }],
  },
};
// Native open dialogs attached to the asking window; a cancelled dialog returns null.
function filePicker({ dialog, BrowserWindow }) {
  return {
    async pick(owner, kind) {
      const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(owner), PICKS[kind]);
      return result.canceled ? null : result.filePaths[0];
    },
  };
}
module.exports = { filePicker };
