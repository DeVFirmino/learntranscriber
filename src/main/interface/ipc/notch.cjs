// Every Notch channel answers only to the Notch window itself.
function registerNotch(handle, { window, state, placement, expand, activeId, changed }) {
  handle('notch:expand', (event, expanded) => {
    if (!window.owns(event) || typeof expanded !== 'boolean') throw new Error('Invalid Notch request.');
    if (!window.visible() || window.concealed()) return false;
    expand(expanded);
    return true;
  });
  handle('notch:interactive', (event, active) => {
    if (!window.owns(event) || typeof active !== 'boolean') throw new Error('Invalid Notch interaction request.');
    return window.setInteractive(active);
  });
  handle('notch:move', (event, input) => {
    if (!window.owns(event) || !window.visible() || window.concealed())
      throw new Error('Notch is unavailable for movement.');
    if (!input || !Number.isFinite(input.x) || !Number.isFinite(input.y) || typeof input.commit !== 'boolean')
      throw new Error('Invalid Notch position.');
    return placement.move(input);
  });
  handle('notch:resize', (event, input) => {
    if (!window.owns(event) || !state.expanded() || !window.visible() || window.concealed())
      throw new Error('Notch is unavailable for resizing.');
    if (!input || !Number.isFinite(input.width) || !Number.isFinite(input.height) || typeof input.commit !== 'boolean')
      throw new Error('Invalid Notch size.');
    return placement.resize(input);
  });
  handle('notch:insight-displayed', (event, id) => {
    if (!window.owns(event) || !window.registeredAsNotch()) throw new Error('Invalid Notch request.');
    if (typeof id !== 'string' || !id.trim() || id.length > 200) throw new Error('Invalid display acknowledgement.');
    if (!state.acknowledge(id, { activeId: activeId(), visible: window.visible(), concealed: window.concealed() }))
      return false;
    changed();
    return true;
  });
}
module.exports = { registerNotch };
