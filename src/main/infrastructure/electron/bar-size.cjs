const { barRows, barRowsHeight } = require('../../domain/overlay/bar-rows.cjs');
const { COLLAPSED_HEIGHT, BAR_POPOVER_HEIGHT } = require('../../domain/windows/layout.cjs');

// The floating bar's height: its controls, the session rows it shows above them while the panel is collapsed, and
// room for an open popover. The bar window grows or shrinks upward, so its controls, bottom edge, position and width
// stay where they are. Nothing changes while every window is concealed, so restoring does not flash the rows.
function createBarSize({ privacy, settings, active }) {
  // The prompt and transcript preview rows the bar shows above its controls while the panel is collapsed.
  let rows = { prompt: false, preview: false, guide: false },
    popoverOpen = false;
  const height = () => COLLAPSED_HEIGHT + barRowsHeight(rows) + (popoverOpen ? BAR_POPOVER_HEIGHT : 0);
  return {
    height,
    rows: () => ({ ...rows }),
    setPopoverOpen(open) {
      popoverOpen = open;
    },
    // `bar` is the open bar window or null; `panelExpanded` and `capturing` come from the window set.
    sync(bar, { panelExpanded, capturing }) {
      if (privacy().concealed) return;
      rows = barRows({
        hasActiveSession: Boolean(active.id()),
        sessionSurfaceVisible: panelExpanded,
        capturing,
        guiding: Boolean(settings().onboardingGuide),
      });
      if (!bar) return;
      const current = bar.getBounds(),
        next = height();
      if (current.height !== next)
        bar.setBounds({ x: current.x, y: current.y + current.height - next, width: current.width, height: next });
    },
  };
}

module.exports = { createBarSize };
