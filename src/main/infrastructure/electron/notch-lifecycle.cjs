const { notchBounds } = require('../../domain/notch/geometry.cjs');

// The Notch opens on the display that holds its saved position, or on the primary display while it is pinned.
function initialNotchBounds(screen, settings, primaryArea) {
  const area = settings.notchPinned
    ? primaryArea
    : screen.getDisplayMatching({
        x: settings.notchX,
        y: settings.notchY,
        width: settings.notchWidth,
        height: settings.notchHeight,
      }).workArea;
  return notchBounds(settings, area, false);
}

// The Notch window exists only while it is enabled and a session is live. Expanding it resizes it in place.
function createNotchWindow({ create, open, screen, settings, active, notchState, privacy, changed }) {
  let notch = null;
  return {
    window: () => notch,
    setExpanded(expanded) {
      notchState.setExpanded(expanded);
      if (!open(notch)) return;
      const area = screen.getDisplayMatching(notch.getBounds()).workArea;
      notch.setBounds(notchBounds(settings(), area, expanded));
      if (expanded && !privacy().concealed) privacy().show(notch, false);
      else privacy().hide(notch);
      changed();
    },
    sync() {
      if (!settings().notchEnabled || !active.id()) {
        if (open(notch)) privacy().hide(notch);
        return;
      }
      if (!open(notch)) {
        notchState.resetExpanded();
        notch = create('notch');
      }
      if (!notchState.expanded()) {
        privacy().hide(notch);
        return;
      }
      if (!privacy().concealed && !notch.webContents.isLoadingMainFrame()) privacy().show(notch, false);
    },
  };
}
module.exports = { createNotchWindow, initialNotchBounds };
