const { shortcutConfig } = require('../../domain/settings/shortcuts.cjs');

const STEP = 30;
const NUDGES = { moveLeft: [-STEP, 0], moveRight: [STEP, 0], moveUp: [0, -STEP], moveDown: [0, STEP] };
// Shortcuts that reach the session surfaces only while the app is not hidden.
// The other five actions (hide, overlay, onTop, opacity) always run.
const SURFACE_ACTIONS = new Set([
  'ask',
  'capture',
  'record',
  'mic',
  'scrollUp',
  'scrollDown',
  'previousInsight',
  'nextInsight',
  'previousResponse',
  'nextResponse',
  'moveLeft',
  'moveRight',
  'moveUp',
  'moveDown',
]);
const OPACITY_STEP = 0.1;

// What each global shortcut does. Window and settings toggles happen here; workspace actions are forwarded to the
// session panel, the Notch or the main window, which owns recording. Returns whether the action was delivered.
function createShortcutActions({
  privacy,
  windows,
  settings,
  saveSettings,
  active,
  nativeContext,
  broadcast,
  changed,
  suspended = () => false,
  visibility = null,
  platform,
}) {
  function readSelection() {
    const sessionId = active.id();
    if (!sessionId) return;
    void nativeContext
      .selection()
      .then((result) => {
        if (active.id() !== sessionId || privacy().concealed) return;
        if (result.text?.trim()) {
          broadcast('context:selection', { ...result, sessionId });
          windows.showMain();
        } else broadcast('integration:error', 'No selected text is available from the focused application.');
      })
      .catch((error) => broadcast('integration:error', error.message));
  }
  const send = (window, action) => {
    if (!windows.open(window)) return false;
    window.webContents.send('workspace:action', action);
    return true;
  };
  const shown = (window) => windows.open(window) && window.isVisible();
  return {
    accelerator(id) {
      const item = shortcutConfig(settings().shortcuts, platform).find((entry) => entry.id === id);
      return item?.enabled ? item.accelerator : undefined;
    },
    dispatch(action) {
      if (suspended()) return false;
      if (SURFACE_ACTIONS.has(action) && privacy().concealed) return false;
      if (action === 'hide') {
        if (visibility) visibility.press();
        else {
          privacy().toggleConcealment();
          changed();
        }
        return true;
      }
      if (action === 'escape') {
        if (privacy().concealed || !windows.barVisible()) return false;
        return send(windows.bar(), 'escape');
      }
      if (action === 'overlay') {
        windows.toggleOverlay();
        return true;
      }
      if (action === 'clickThrough') {
        saveSettings({ overlayClickThrough: !settings().overlayClickThrough });
        return true;
      }
      if (action === 'onTop') {
        saveSettings({ overlayOnTop: !settings().overlayOnTop });
        return true;
      }
      if (action === 'opacityUp' || action === 'opacityDown') {
        const next = settings().overlayOpacity + (action === 'opacityUp' ? OPACITY_STEP : -OPACITY_STEP);
        saveSettings({ overlayOpacity: Math.round(Math.max(0.25, Math.min(1, next)) * 100) / 100 });
        return true;
      }
      if (action === 'notch') {
        saveSettings({ notchEnabled: !settings().notchEnabled });
        return true;
      }
      if (action === 'selection') {
        readSelection();
        return true;
      }
      // Sliding, scrolling and jumping act on the visible session panel;
      // scrolling falls back to the Notch. The recording bar never moves.
      const panel = windows.panelVisible() ? windows.overlay() : null;
      if (action in NUDGES) {
        if (!panel) return false;
        windows.nudgePanel(...NUDGES[action]);
        return true;
      }
      if (action === 'scrollUp' || action === 'scrollDown') {
        if (panel) return send(panel, action);
        return shown(windows.notch()) ? send(windows.notch(), action) : false;
      }
      if (action === 'previousResponse' || action === 'nextResponse') return panel ? send(panel, action) : false;
      if (action === 'previousInsight' || action === 'nextInsight')
        return shown(windows.notch()) ? send(windows.notch(), action) : false;
      // Ask, capture and live analysis belong to the floating assistant: they open the panel's Session tab,
      // where the screenshot waits beside the question box, instead of bringing the workspace forward. The workspace
      // never receives these actions.
      const analyzing = action === 'record' && windows.listening().active;
      if (action === 'ask' || action === 'capture' || analyzing) {
        windows.showOverlay();
        const overlay = windows.overlay();
        if (windows.open(overlay)) {
          if (!windows.overlayExpanded()) windows.setOverlayExpanded(overlay, true);
          const deliver = () => {
            if (overlay.isDestroyed()) return;
            overlay.focus();
            overlay.webContents.send('workspace:action', analyzing ? 'analyze' : action);
          };
          if (overlay.webContents.isLoadingMainFrame()) overlay.webContents.once('did-finish-load', deliver);
          else deliver();
          return true;
        }
        return false;
      }
      // Only the workspace owns audio capture; live analysis belongs to the visible panel above.
      if (action === 'record' || action === 'toggleRecording') windows.showOverlay();
      const main = windows.ensureMain();
      const deliver = () => {
        if (!main.isDestroyed()) main.webContents.send('workspace:action', action);
      };
      if (main.webContents.isLoadingMainFrame()) main.webContents.once('did-finish-load', deliver);
      else deliver();
      return true;
    },
  };
}
module.exports = { createShortcutActions, SURFACE_ACTIONS };
