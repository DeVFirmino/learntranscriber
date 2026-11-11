// Which application window sent an IPC request, and in which role (main, overlay or notch) it was registered.
function windowCallers({ BrowserWindow, privacy, windows }) {
  const windowOf = (event) => BrowserWindow.fromWebContents(event.sender);
  return {
    windowOf,
    roleOf: (event) => privacy().windows.get(windowOf(event)),
    isMain: (event) => windowOf(event) === windows.main(),
  };
}
module.exports = { windowCallers };
