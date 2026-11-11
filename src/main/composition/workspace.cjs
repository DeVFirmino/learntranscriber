const { discoverLocalServers } = require('../infrastructure/local/server-discovery.cjs');
const { createHistoryData } = require('../application/sessions/history-data.cjs');
const { registerWorkspace } = require('../interface/ipc/workspace.cjs');
const { registerWindows } = require('../interface/ipc/windows.cjs');
const { createMainActions } = require('../infrastructure/electron/main-actions.cjs');
const { createNotchPlacement } = require('../application/notch/placement.cjs');
const { registerNotch } = require('../interface/ipc/notch.cjs');

// Wires the workspace-wide channels, the window controls and the Notch to their IPC channels.
function composeWorkspace({
  handle,
  repositories,
  active,
  state,
  shortcuts,
  compactor,
  generate,
  callers,
  quit,
  folders,
  windows,
  privacy,
  notch,
  saveSettings,
  fanOut,
  changed,
}) {
  registerWorkspace(handle, {
    state,
    shortcuts,
    discover: { localServers: discoverLocalServers },
    history: createHistoryData({
      history: repositories.history,
      entries: repositories.entries,
      active,
      compactor,
      changed,
    }),
    folders,
    generate,
    callers,
    quit,
    errors: {
      log: (message) => console.error(`Shown to the user: ${message}`),
      forward: (sender, message) => fanOut.toOthers(sender, 'integration:error', message),
    },
  });
  registerWindows(handle, { callers, windows, mainActions: createMainActions({ windows }), privacy, changed });
  registerNotch(handle, {
    window: notch.window,
    state: notch.state,
    expand: (expanded) => windows.setNotchExpanded(expanded),
    activeId: active.id,
    changed,
    placement: createNotchPlacement({
      window: notch.window,
      state: notch.state,
      settings: () => repositories.settings.read(),
      saveSettings,
    }),
  });
}
module.exports = { composeWorkspace };
