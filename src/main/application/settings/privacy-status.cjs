const { menuBarState } = require('../../domain/overlay/menu-bar.cjs');

// The privacy panel: the controller's status, the shortcuts that restore hidden windows, and whether the menu
// bar icon stays as the way back, although settings hide it, because the hide shortcut did not register.
function privacyStatus({ privacy, settings, shortcutStatus, accelerator, menuBarIconVisible }) {
  return {
    ...privacy.status(),
    shortcutStatus,
    shortcuts: {
      hide: accelerator('hide') || '',
      overlay: accelerator('overlay') || '',
      clickThrough: accelerator('clickThrough') || '',
    },
    menuBarIconVisible,
    menuBarRecoveryFallback: menuBarState(settings, shortcutStatus.hide).recoveryFallback,
  };
}
module.exports = { privacyStatus };
