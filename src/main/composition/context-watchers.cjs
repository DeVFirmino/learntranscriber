const { createSelectionWatcher } = require('../application/context/selection-watcher.cjs');
const { createCopyWatcher } = require('../application/context/copy-watcher.cjs');
const { disableSelectionOnFailure } = require('../application/context/selection-failure.cjs');

// Builds the desktop watchers behind automatic answers: selected text feeds screen insights, and a copied
// selection asks for an answer. Publication points both at the live session.
function createContextWatchers({ nativeContext, clipboard, insights, settings, changed, report }) {
  return {
    selection: createSelectionWatcher({
      read: (signal) => nativeContext.selection(signal),
      onSelection: (value) => insights.selected(value),
      onError: disableSelectionOnFailure({ settings, changed, report }),
      timers: { setInterval, clearInterval },
    }),
    copy: createCopyWatcher({
      readClipboard: () => clipboard.readText(),
      readSelection: () => nativeContext.selection(),
      onCopy: (value) => insights.copied(value),
      onError: report,
      timers: { setInterval, clearInterval },
    }),
  };
}
module.exports = { createContextWatchers };
