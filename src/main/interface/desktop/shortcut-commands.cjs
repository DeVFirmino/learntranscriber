const STEP = 30;
const NUDGES = { moveLeft: [-STEP, 0], moveRight: [STEP, 0], moveUp: [0, -STEP], moveDown: [0, STEP] };

// Each command selects a delivery strategy or changes one desktop setting; dispatch does not interpret action IDs.
function createShortcutCommands({
  privacy,
  windows,
  settings,
  saveSettings,
  changed,
  visibility,
  delivery,
  readSelection,
}) {
  const save = (patch) => {
    saveSettings(patch);
    return true;
  };
  const toggle = (key) => () => save({ [key]: !settings()[key] });
  const opacity = (step) => () =>
    save({ overlayOpacity: Math.round(Math.max(0.25, Math.min(1, settings().overlayOpacity + step)) * 100) / 100 });
  const recording = (action) => {
    windows.showOverlay();
    return delivery.main(action);
  };
  return {
    hide() {
      if (visibility) visibility.press();
      else {
        privacy().toggleConcealment();
        changed();
      }
      return true;
    },
    escape: () => !privacy().concealed && delivery.bar('escape'),
    overlay() {
      windows.toggleOverlay();
      return true;
    },
    clickThrough: toggle('overlayClickThrough'),
    onTop: toggle('overlayOnTop'),
    notch: toggle('notchEnabled'),
    opacityUp: opacity(0.1),
    opacityDown: opacity(-0.1),
    selection() {
      readSelection();
      return true;
    },
    ask: () => delivery.assistant('ask'),
    capture: () => delivery.assistant('capture'),
    record: () => (windows.listening().active ? delivery.assistant('analyze') : recording('record')),
    toggleRecording: () => recording('toggleRecording'),
    mic: () => delivery.main('mic'),
    scrollUp: () => delivery.scroll('scrollUp'),
    scrollDown: () => delivery.scroll('scrollDown'),
    previousResponse: () => delivery.panel('previousResponse'),
    nextResponse: () => delivery.panel('nextResponse'),
    previousInsight: () => delivery.notch('previousInsight'),
    nextInsight: () => delivery.notch('nextInsight'),
    ...Object.fromEntries(Object.entries(NUDGES).map(([id, delta]) => [id, () => delivery.nudge(...delta)])),
  };
}
module.exports = { createShortcutCommands };
