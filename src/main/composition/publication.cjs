const { createWorkspacePublication } = require('../application/runtime/publication.cjs');

// What a change sets off: the Notch, the floating bar and its Escape shortcut, the desktop watchers and screen
// insights follow the live session and privacy, and every window receives the new state.
function composePublication({
  active,
  privacy,
  settings,
  notchState,
  windows,
  shortcuts,
  watchers,
  screenInsights,
  tray,
  workspaceState,
  broadcast,
}) {
  return createWorkspacePublication({
    active,
    privacy: {
      get concealed() {
        return privacy().concealed;
      },
    },
    settings,
    notch: { prune: (context) => notchState.prune(context), sync: () => windows.syncNotch() },
    bar: {
      sync: () => {
        windows.syncBar();
        shortcuts.registry()?.setEscapeEnabled(windows.barVisible());
        if (privacy().concealed) shortcuts.visibility()?.cancel();
      },
    },
    watchers: {
      copy: (id, enabled) => watchers.copy()?.update(id, enabled),
      selection: (id, enabled) => watchers.selection()?.update(id, enabled),
    },
    insights: { cancel: () => screenInsights.cancel() },
    tray: { update: () => tray().update() },
    state: { snapshot: () => workspaceState().snapshot() },
    broadcast,
  });
}
module.exports = { composePublication };
