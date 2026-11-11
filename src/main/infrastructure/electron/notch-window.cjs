// The Notch BrowserWindow as the application sees it: whoever is asking, where it is and how to move it.
function notchWindowAdapter({ current, BrowserWindow, screen, privacy }) {
  const window = () => current();
  return {
    open: () => Boolean(window() && !window().isDestroyed()),
    owns: (event) => {
      const notch = window();
      return Boolean(notch) && BrowserWindow.fromWebContents(event.sender) === notch;
    },
    registeredAsNotch: () => privacy().windows.get(window()) === 'notch',
    visible: () => window().isVisible(),
    concealed: () => privacy().concealed,
    bounds: () => window().getBounds(),
    setBounds: (bounds) => window().setBounds(bounds),
    workArea: (rect) => screen.getDisplayMatching(rect).workArea,
    setInteractive: (active) => privacy().setNotchInteractive(window(), active),
  };
}
module.exports = { notchWindowAdapter };
