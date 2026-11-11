// IPC is answered only for the bundled renderer's top frame, in a window the privacy controller registered.
const pageOf = (url) => url.split('#')[0].split('?')[0];

function senderTrust({ BrowserWindow, registered, rendererUrl }) {
  return function trusted(event) {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (
      !window ||
      !registered(window) ||
      event.senderFrame !== event.sender.mainFrame ||
      pageOf(event.senderFrame.url) !== rendererUrl
    )
      throw new Error('This request did not originate from an application window.');
  };
}
module.exports = { senderTrust };
