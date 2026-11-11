// Windows only load the bundled renderer, and refuse navigation elsewhere, webviews and popups.
function guardWindow(window, { renderer, isQuitting }) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0].split('?')[0] !== renderer.url) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  // The renderer keeps unsent audio from being lost on reload, but once quit has flushed and reported what was
  // discarded, that guard must not cancel the quit; before this, failed segments kept the app open forever.
  window.webContents.on('will-prevent-unload', (event) => {
    if (isQuitting()) event.preventDefault();
  });
}
module.exports = { guardWindow };
