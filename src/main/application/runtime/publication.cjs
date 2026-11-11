// After any change: settle the Notch and the recording bar's session rows, point the desktop watchers at the live session (or stop them while the
// windows are concealed), refresh the tray, then send every window the new state, in that order.
const { modeConfig } = require('../../domain/sessions/realtime-policy.cjs');

function createWorkspacePublication({
  active,
  privacy,
  settings,
  notch,
  bar,
  watchers,
  insights,
  tray,
  state,
  broadcast,
}) {
  return {
    changed() {
      const id = active.id(),
        concealed = privacy.concealed;
      notch.prune({ activeId: id, concealed });
      notch.sync();
      bar.sync();
      watchers.copy(id, settings().copyToPrompt && !concealed);
      if (!id || concealed) insights.cancel();
      watchers.selection(id, settings().autoSelection && modeConfig(settings().insightMode).selection && !concealed);
      tray.update();
      broadcast('workspace:changed', state.snapshot());
    },
  };
}
module.exports = { createWorkspacePublication };
