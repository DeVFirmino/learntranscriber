const KINDS = {
  markdown: { defaultPath: 'session.md', filters: [{ name: 'Markdown', extensions: ['md'] }] },
  srt: { defaultPath: 'session.srt', filters: [{ name: 'SubRip captions', extensions: ['srt'] }] },
  vtt: { defaultPath: 'session.vtt', filters: [{ name: 'WebVTT captions', extensions: ['vtt'] }] },
};

// Asks where to save a session export in the chosen format and replaces the file atomically.
function sessionExportDestination({ dialog, BrowserWindow, writeFileAtomic }) {
  return {
    async choose(owner, format = 'markdown') {
      const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(owner), KINDS[format] || KINDS.markdown);
      return result.canceled || !result.filePath ? null : result.filePath;
    },
    write: (path, content) => writeFileAtomic(path, content),
  };
}
module.exports = { sessionExportDestination };
