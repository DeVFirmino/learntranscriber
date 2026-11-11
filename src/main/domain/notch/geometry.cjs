const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function notchBounds(settings, area, expanded) {
  const width = expanded
    ? clamp(settings.notchWidth, Math.min(360, area.width), Math.min(900, area.width))
    : Math.min(84, area.width);
  const height = expanded
    ? clamp(settings.notchHeight, Math.min(160, area.height), Math.min(640, area.height))
    : Math.min(48, area.height);
  const expandedWidth = clamp(settings.notchWidth, Math.min(360, area.width), Math.min(900, area.width));
  const desiredX = settings.notchPinned
    ? area.x + Math.round((area.width - width) / 2)
    : settings.notchX + (expanded ? 0 : Math.round((expandedWidth - width) / 2));
  const desiredY = settings.notchPinned ? area.y + 8 : settings.notchY;
  return {
    x: clamp(desiredX, area.x, area.x + area.width - width),
    y: clamp(desiredY, area.y, area.y + area.height - height),
    width,
    height,
  };
}

function movedNotchBounds(current, area, x, y, commit) {
  const width = Math.min(current.width, area.width),
    height = Math.min(current.height, area.height);
  const moved = {
    x: clamp(Math.round(x), area.x, area.x + area.width - width),
    y: clamp(Math.round(y), area.y, area.y + area.height - height),
    width,
    height,
  };
  const snapX = area.x + Math.round((area.width - width) / 2),
    snapY = clamp(area.y + 8, area.y, area.y + area.height - height);
  const pinned = Boolean(commit && Math.hypot(moved.x - snapX, moved.y - snapY) <= 150);
  return { bounds: pinned ? { ...moved, x: snapX, y: snapY } : moved, pinned };
}

function resizedNotchBounds(current, area, width, height, pinned) {
  const nextWidth = clamp(Math.round(width), Math.min(360, area.width), Math.min(900, area.width));
  const nextHeight = clamp(Math.round(height), Math.min(160, area.height), Math.min(640, area.height));
  return {
    x: pinned
      ? area.x + Math.round((area.width - nextWidth) / 2)
      : clamp(current.x, area.x, area.x + area.width - nextWidth),
    y: clamp(current.y, area.y, area.y + area.height - nextHeight),
    width: nextWidth,
    height: nextHeight,
  };
}

module.exports = { notchBounds, movedNotchBounds, resizedNotchBounds };
