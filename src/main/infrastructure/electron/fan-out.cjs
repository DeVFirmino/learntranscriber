// Which application windows receive each main-process event. Insight streams and results skip the Notch.
function windowFanOut({ BrowserWindow, windows }) {
  const open = (window) => Boolean(window && !window.isDestroyed());
  const send = (targets, channel, payload) => {
    for (const window of targets) if (open(window)) window.webContents.send(channel, payload);
  };
  const audience = (mode) =>
    BrowserWindow.getAllWindows().filter((window) => mode !== 'insight' || window !== windows.notch());
  return {
    broadcast: (channel, payload) => send(BrowserWindow.getAllWindows(), channel, payload),
    // The bar shows the request processing until its first words reach the panel.
    overlayDelta(payload, mode) {
      const floating = [windows.overlay(), windows.bar()];
      const targets = mode === 'insight' ? floating : [...floating, windows.notch()];
      send(targets, 'overlay:delta', payload);
    },
    answer: (payload, mode) => send(audience(mode), 'overlay:answer', payload),
    finished: (payload, mode) => send(audience(mode), 'overlay:finished', payload),
    toSender(sender, channel, payload) {
      if (!sender.isDestroyed()) sender.send(channel, payload);
    },
    // User-facing feedback has one owner: the open panel, the focused app window, or the recording bar.
    toVisible(sender, channel, payload) {
      const shown = (window) => open(window) && window.isVisible();
      const targets = [
        windows.panelVisible() ? windows.overlay() : null,
        BrowserWindow.getFocusedWindow(),
        windows.bar(),
        BrowserWindow.getAllWindows().find((window) => window.webContents === sender),
      ];
      send([targets.find(shown)], channel, payload);
    },
    // The window whose renderer started a voice conversation, found by its web contents id.
    toOwner(owner, channel, payload) {
      const target = BrowserWindow.getAllWindows().find(
        (window) => open(window) && !window.webContents.isDestroyed() && window.webContents.id === owner,
      );
      target?.webContents.send(channel, payload);
    },
  };
}
module.exports = { windowFanOut };
