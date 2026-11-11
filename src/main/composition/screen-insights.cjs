const { randomUUID } = require('node:crypto');
const { createScreenInsights } = require('../application/context/screen-insights.cjs');

// Screen insights look at the screen while the live session listens and someone speaks, and ask for the answer in
// the main window while it is open.
function composeScreenInsights({
  settings,
  active,
  privacy,
  requests,
  windows,
  liveSpeech,
  screenshot,
  broadcast,
  generate,
}) {
  return createScreenInsights({
    settings,
    active,
    privacy: {
      get concealed() {
        return privacy().concealed;
      },
    },
    requests,
    speaking: () => windows.listening().active && liveSpeech.speaking(active.id()),
    screenshot,
    newId: randomUUID,
    report: (message) => broadcast('integration:error', message),
    clock: Date.now,
    timers: { setTimeout, clearTimeout },
    showSelection: (value) => broadcast('context:selection', value),
    ask: {
      available: () => Boolean(windows.main() && !windows.main().isDestroyed()),
      run: (input) => generate({ sender: windows.main().webContents }, input),
    },
  });
}
module.exports = { composeScreenInsights };
