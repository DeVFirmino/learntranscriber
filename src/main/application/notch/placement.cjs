const { movedNotchBounds, resizedNotchBounds } = require('../../domain/notch/geometry.cjs');

// Dragging and resizing the Notch. Intermediate steps only move the window; a commit also saves the placement,
// storing the collapsed centre so the Notch reopens where the user left it.
function createNotchPlacement({ window, state, settings, saveSettings }) {
  return {
    move({ x, y, commit }) {
      const current = window.bounds(),
        area = window.workArea({ x: Math.round(x), y: Math.round(y), width: current.width, height: current.height });
      const result = movedNotchBounds(current, area, x, y, commit);
      window.setBounds(result.bounds);
      if (commit)
        saveSettings({
          notchPinned: result.pinned,
          notchX: state.expanded()
            ? result.bounds.x
            : result.bounds.x - Math.round((settings().notchWidth - result.bounds.width) / 2),
          notchY: result.bounds.y,
        });
      return result.bounds;
    },
    resize({ width, height, commit }) {
      const current = window.bounds(),
        area = window.workArea(current);
      const result = resizedNotchBounds(current, area, width, height, settings().notchPinned);
      window.setBounds(result);
      if (commit)
        saveSettings({ notchWidth: result.width, notchHeight: result.height, notchX: result.x, notchY: result.y });
      return result;
    },
  };
}
module.exports = { createNotchPlacement };
