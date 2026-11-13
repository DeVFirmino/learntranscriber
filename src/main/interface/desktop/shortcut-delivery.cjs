// Delivers workspace commands to their owning window, including windows still loading their renderer.
function createShortcutDelivery({ windows }) {
  const open = (window) => windows.open(window);
  const shown = (window) => open(window) && window.isVisible();
  const panel = () => (windows.panelVisible() ? windows.overlay() : null);
  function send(window, action) {
    if (!open(window)) return false;
    window.webContents.send('workspace:action', action);
    return true;
  }
  function afterLoad(window, deliver) {
    if (window.webContents.isLoadingMainFrame()) window.webContents.once('did-finish-load', deliver);
    else deliver();
    return true;
  }
  return {
    main(action) {
      const window = windows.ensureMain();
      return afterLoad(window, () => send(window, action));
    },
    assistant(action) {
      windows.showOverlay();
      const window = windows.overlay();
      if (!open(window)) return false;
      if (!windows.overlayExpanded()) windows.setOverlayExpanded(window, true);
      return afterLoad(window, () => {
        if (!open(window)) return;
        window.focus();
        send(window, action);
      });
    },
    panel: (action) => send(panel(), action),
    notch: (action) => send(shown(windows.notch()) ? windows.notch() : null, action),
    bar: (action) => send(windows.barVisible() ? windows.bar() : null, action),
    scroll(action) {
      const targets = [panel(), windows.notch()];
      return send(targets.find(shown), action);
    },
    nudge(dx, dy) {
      if (!panel()) return false;
      windows.nudgePanel(dx, dy);
      return true;
    },
  };
}
module.exports = { createShortcutDelivery };
