// Brings the workspace forward and runs one of its renderer actions, such as opening a page, once the page has
// loaded: a window created just now would otherwise miss the message.
function createMainActions({ windows }) {
  return {
    open(action) {
      windows.showMain();
      const target = windows.main();
      if (!target || target.isDestroyed()) return;
      const run = () => {
        if (!target.isDestroyed()) target.webContents.send('workspace:action', action);
      };
      if (target.webContents.isLoadingMainFrame()) target.webContents.once('did-finish-load', run);
      else run();
    },
  };
}
module.exports = { createMainActions };
