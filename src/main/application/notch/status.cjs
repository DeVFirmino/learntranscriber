// The Notch in the public state: its presentation for the live session, and its window's place while it is open.
function notchStatus({ state, activeId, window, pinned }) {
  const open = window.open();
  return {
    expanded: state.expanded(),
    visible: open && window.visible(),
    ...state.status(activeId),
    bounds: open ? window.bounds() : null,
    pinned,
  };
}
module.exports = { notchStatus };
