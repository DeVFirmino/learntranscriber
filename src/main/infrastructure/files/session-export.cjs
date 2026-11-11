// Asks where to save a Markdown export and replaces the file atomically.
function sessionExportDestination({ dialog, BrowserWindow, writeFileAtomic }) {
  return {
    async choose(owner) {
      const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(owner), {
        defaultPath: 'session.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      return result.canceled || !result.filePath ? null : result.filePath;
    },
    write: (path, content) => writeFileAtomic(path, content),
  };
}
module.exports = { sessionExportDestination };
