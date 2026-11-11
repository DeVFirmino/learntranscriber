const { windowFanOut } = require('../infrastructure/electron/fan-out.cjs');
const { notchWindowAdapter } = require('../infrastructure/electron/notch-window.cjs');
const { createWindows } = require('../infrastructure/electron/windows.cjs');

// The app's windows, the Notch window's own adapter, and the fan-out that sends an event to every window. A window
// that closes leaves its requests and voices to the owner cleanup.
function composeWindows({
  electron: { BrowserWindow, screen },
  ownerCleanup,
  privacy,
  settings,
  active,
  notchState,
  renderer,
  preload,
  platform,
  isQuitting,
  changed,
  onSettingsOpen,
}) {
  const windows = createWindows({
    BrowserWindow,
    screen,
    privacy,
    settings,
    active,
    notchState,
    renderer,
    preload,
    platform,
    isQuitting,
    changed,
    onOwnerDestroyed: (ownerId) => ownerCleanup.destroyed(ownerId),
    onSettingsOpen,
  });
  const notchWindow = notchWindowAdapter({ current: () => windows.notch(), BrowserWindow, screen, privacy });
  const fanOut = windowFanOut({ BrowserWindow, windows });
  return { windows, notchWindow, fanOut, broadcast: (channel, payload) => fanOut.broadcast(channel, payload) };
}
module.exports = { composeWindows };
