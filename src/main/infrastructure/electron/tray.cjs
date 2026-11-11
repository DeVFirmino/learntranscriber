// The menu bar icon and its menu. It is hidden when settings say so, unless it is the only way back to hidden
// windows (menuBarState decides).
function createTray({
  Tray,
  Menu,
  nativeImage,
  iconPath,
  menuBarState,
  settings,
  shortcutStatus,
  privacy,
  active,
  accelerator,
  actions,
}) {
  let tray = null;
  return {
    visible: () => Boolean(tray && !tray.isDestroyed()),
    update() {
      const current = settings();
      if (!menuBarState(current, shortcutStatus.hide).visible) {
        tray?.destroy();
        tray = null;
        return;
      }
      if (!tray || tray.isDestroyed()) {
        const image = nativeImage.createFromPath(iconPath);
        image.setTemplateImage(true);
        tray = new Tray(image);
        tray.on('click', actions.showMain);
      }
      const concealed = privacy().concealed;
      tray.setToolTip(
        `LearnTranscriber${active.id() ? ' · Active session' : ''}${concealed ? ' · Windows hidden' : ''}`,
      );
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: 'Open workspace', click: actions.showMain },
          {
            label: concealed ? 'Restore hidden windows' : 'Hide all windows',
            accelerator: accelerator('hide'),
            click: actions.toggleConcealment,
          },
          { label: 'Toggle floating assistant', accelerator: accelerator('overlay'), click: actions.toggleOverlay },
          { type: 'separator' },
          {
            label: 'Stealth mode',
            type: 'checkbox',
            checked: current.stealthMode,
            click: (item) => actions.saveSettings({ stealthMode: item.checked }),
          },
          {
            label: 'Request capture protection',
            enabled: !current.stealthMode,
            type: 'checkbox',
            checked: privacy().protected,
            click: (item) => actions.saveSettings({ captureProtection: item.checked }),
          },
          {
            label: 'Hide Dock icon',
            enabled: !current.stealthMode,
            type: 'checkbox',
            checked: privacy().hideDock,
            click: (item) => actions.saveSettings({ hideDock: item.checked }),
          },
          {
            label: 'Click-through overlay',
            type: 'checkbox',
            checked: current.overlayClickThrough,
            click: (item) => actions.saveSettings({ overlayClickThrough: item.checked }),
          },
          { type: 'separator' },
          { label: 'Quit LearnTranscriber', click: actions.quit },
        ]),
      );
    },
  };
}
module.exports = { createTray };
