// The floating assistant is a transparent window anchored to the bottom centre of the screen:
// collapsed it holds the assistant pill and the bar, expanded it adds the session panel above.
const COLLAPSED_HEIGHT = 132,
  OVERLAY_WIDTH = 560,
  // Room the bar grows upward for an open popover: the assistant picker or the shortcut sheet.
  BAR_POPOVER_HEIGHT = 300;

// Where a new window opens and how small it may get. `notch` is the Notch's own bounds, `barHeight` the bar's height
// with its current rows, and `expandedHeight` the height the user last gave the session panel.
function windowFrame({ role, surface, display, notch, expandedHeight, barHeight }) {
  if (role === 'notch')
    return {
      width: notch.width,
      height: notch.height,
      minWidth: 84,
      minHeight: 48,
      x: notch.x,
      y: notch.y,
      resizable: false,
    };
  if (role === 'overlay') {
    const isBar = surface === 'bar';
    return {
      width: OVERLAY_WIDTH,
      height: isBar ? barHeight : expandedHeight,
      minWidth: 420,
      minHeight: isBar ? COLLAPSED_HEIGHT : 240,
      x: display.x + Math.max(0, Math.floor((display.width - OVERLAY_WIDTH) / 2)),
      y: display.y + display.height - 16 - (isBar ? barHeight : COLLAPSED_HEIGHT + 8 + expandedHeight),
      resizable: !isBar,
    };
  }
  return { width: 1180, height: 850, minWidth: 700, minHeight: 500, x: undefined, y: undefined, resizable: true };
}

// The session panel resized inside its display, keeping its bottom edge where it was.
function resizedPanel(current, area, width, height) {
  const nextWidth = Math.round(Math.max(420, Math.min(width, area.width))),
    nextHeight = Math.round(Math.max(240, Math.min(height, area.height - 32)));
  const bottom = Math.min(current.y + current.height, area.y + area.height - 16);
  return {
    x: Math.max(area.x, Math.min(current.x, area.x + area.width - nextWidth)),
    y: Math.max(area.y, bottom - nextHeight),
    width: nextWidth,
    height: nextHeight,
  };
}

// A window moved by a step without leaving its display.
function nudged(bounds, area, dx, dy) {
  return {
    x: Math.max(area.x, Math.min(area.x + area.width - bounds.width, bounds.x + dx)),
    y: Math.max(area.y, Math.min(area.y + area.height - bounds.height, bounds.y + dy)),
  };
}

// A window pulled back inside a display, shrunk first if it is larger than the display.
function insideArea(bounds, area) {
  return {
    width: Math.min(bounds.width, area.width),
    height: Math.min(bounds.height, area.height),
    x: Math.min(Math.max(bounds.x, area.x), area.x + Math.max(0, area.width - bounds.width)),
    y: Math.min(Math.max(bounds.y, area.y), area.y + Math.max(0, area.height - bounds.height)),
  };
}

module.exports = { COLLAPSED_HEIGHT, BAR_POPOVER_HEIGHT, windowFrame, resizedPanel, nudged, insideArea };
