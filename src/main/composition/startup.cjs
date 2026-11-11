const { installApplicationMenu } = require('../infrastructure/electron/app-menu.cjs');
const { createMainActions } = require('../infrastructure/electron/main-actions.cjs');
const { ShortcutRegistry } = require('../infrastructure/electron/shortcut-registry.cjs');
const { composeSystemEvents } = require('./system-events.cjs');

// The desktop as start() leaves it: the workspace window, shown unless the app opens floating, privacy applied, the
// global shortcuts registered, the system events followed and the application menu installed.
function startDesktop({ electron: { app, globalShortcut, powerMonitor, screen, Menu }, platform, core, started }) {
  const { windows } = core;
  const settings = () => started.repositories.settings.read();
  const launchFloating = settings().launchFloating;
  windows.openMain({ show: !launchFloating });
  started.privacy.update(settings());
  if (launchFloating) windows.showOverlay();
  started.tray.update();
  started.shortcutRegistry = new ShortcutRegistry(
    globalShortcut,
    started.dispatchShortcut,
    (status) => Object.assign(core.shortcutStatus, status),
    platform,
  );
  started.shortcutRegistry.configure(settings().shortcuts);
  started.shortcutRegistry.setSuspended(core.shortcutsSuspended());
  started.shortcutRegistry.setEscapeEnabled(windows.barVisible());
  started.tray.update();
  composeSystemEvents({
    electron: { powerMonitor, app, screen },
    windows,
    privacy: started.privacy,
    settings: core.readSettings,
    changed: core.changed,
  });
  installApplicationMenu({
    Menu,
    name: app.name,
    showMain: windows.showMain,
    openSettings: () => createMainActions({ windows }).open('openSettings'),
    hide: () => started.dispatchShortcut('hide'),
    hideAccelerator: started.shortcutAccelerator('hide'),
  });
}
module.exports = { startDesktop };
