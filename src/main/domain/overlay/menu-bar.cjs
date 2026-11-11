// The menu bar icon shows when settings ask for it, and also as the way back to hidden windows when the hide
// shortcut did not register.
function menuBarState(settings, restoreShortcutAvailable) {
  return {
    visible: settings.showMenuBarIcon !== false || !restoreShortcutAvailable,
    recoveryFallback: settings.showMenuBarIcon === false && !restoreShortcutAvailable,
  };
}
module.exports = { menuBarState };
