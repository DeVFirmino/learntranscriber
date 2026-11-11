const { menuBarState } = require('../domain/overlay/menu-bar.cjs');
const { createVisibilityShortcut } = require('../domain/overlay/visibility-shortcut.cjs');
const { createShortcutActions } = require('../interface/desktop/shortcuts.cjs');
const { createTray } = require('../infrastructure/electron/tray.cjs');

// Builds the hide-all shortcut, the global shortcut actions and the menu bar icon. The shortcut and the menu bar
// toggle concealment the same way.
function composeDesktopControls({
  electron: { Tray, Menu, nativeImage },
  iconPath,
  privacy,
  windows,
  settings,
  saveSettings,
  active,
  nativeContext,
  shortcutStatus,
  suspended,
  platform,
  broadcast,
  changed,
  quit,
}) {
  const toggleConcealment = () => {
    privacy().toggleConcealment();
    changed();
  };
  const visibility = createVisibilityShortcut({
    concealed: () => privacy().concealed,
    toggle: toggleConcealment,
    fade: (opacity) => windows.fadePanel(opacity),
    timers: { setTimeout, clearTimeout },
  });
  const shortcuts = createShortcutActions({
    visibility,
    suspended,
    privacy,
    windows,
    settings,
    saveSettings,
    active,
    nativeContext,
    platform,
    broadcast,
    changed,
  });
  const tray = createTray({
    Tray,
    Menu,
    nativeImage,
    iconPath,
    menuBarState,
    settings,
    shortcutStatus,
    privacy,
    active,
    accelerator: (id) => shortcuts.accelerator(id),
    actions: {
      showMain: () => windows.showMain(),
      toggleConcealment,
      toggleOverlay: () => windows.toggleOverlay(),
      saveSettings,
      quit,
    },
  });
  return { visibility, shortcuts, tray };
}
module.exports = { composeDesktopControls };
