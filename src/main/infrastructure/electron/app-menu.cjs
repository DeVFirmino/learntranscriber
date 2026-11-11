// The application menu in the standard macOS order: About, Settings, the app's own window actions, Services, the
// system hide items and Quit, then the standard edit and window menus. "Hide all windows" is the app's privacy hide
// with its configurable shortcut; the system Hide keeps Command-H.
function installApplicationMenu({ Menu, name, showMain, openSettings, hide, hideAccelerator }) {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { label: 'Settings…', accelerator: 'CommandOrControl+,', click: openSettings },
          { type: 'separator' },
          { label: 'Open workspace', click: showMain },
          { label: 'Hide all windows', accelerator: hideAccelerator, click: hide },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { role: 'editMenu' },
      { role: 'windowMenu' },
    ]),
  );
}
module.exports = { installApplicationMenu };
