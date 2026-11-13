const { shortcutConfig } = require('../../domain/settings/shortcuts.cjs');

const { createShortcutDelivery } = require('./shortcut-delivery.cjs');
const { createShortcutCommands } = require('./shortcut-commands.cjs');
// Shortcuts that reach the session surfaces only while the app is not hidden.
// The other five actions (hide, overlay, onTop, opacity) always run.
const SURFACE_ACTIONS = new Set([
  'ask',
  'capture',
  'record',
  'mic',
  'scrollUp',
  'scrollDown',
  'previousInsight',
  'nextInsight',
  'previousResponse',
  'nextResponse',
  'moveLeft',
  'moveRight',
  'moveUp',
  'moveDown',
]);

// What each global shortcut does. Window and settings toggles happen here; workspace actions are forwarded to the
// session panel, the Notch or the main window, which owns recording. Returns whether the action was delivered.
function createShortcutActions({
  privacy,
  windows,
  settings,
  saveSettings,
  active,
  nativeContext,
  broadcast,
  changed,
  suspended = () => false,
  visibility = null,
  platform,
}) {
  function readSelection() {
    const sessionId = active.id();
    if (!sessionId) return;
    void nativeContext
      .selection()
      .then((result) => {
        if (active.id() !== sessionId || privacy().concealed) return;
        if (result.text?.trim()) {
          broadcast('context:selection', { ...result, sessionId });
          windows.showMain();
        } else broadcast('integration:error', 'No selected text is available from the focused application.');
      })
      .catch((error) => broadcast('integration:error', error.message));
  }
  const delivery = createShortcutDelivery({ windows });
  const commands = createShortcutCommands({
    privacy,
    windows,
    settings,
    saveSettings,
    changed,
    visibility,
    delivery,
    readSelection,
  });
  return {
    accelerator(id) {
      const item = shortcutConfig(settings().shortcuts, platform).find((entry) => entry.id === id);
      return item?.enabled ? item.accelerator : undefined;
    },
    dispatch(action) {
      if (suspended()) return false;
      if (SURFACE_ACTIONS.has(action) && privacy().concealed) return false;
      return Object.hasOwn(commands, action) ? commands[action]() : delivery.main(action);
    },
  };
}
module.exports = { createShortcutActions, SURFACE_ACTIONS };
