const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installApplicationMenu } = require('../src/main/infrastructure/electron/app-menu.cjs');

test('the application menu follows the macOS order with Settings, the privacy hide and the system hide items', () => {
  let installed;
  const Menu = { buildFromTemplate: (template) => ({ template }), setApplicationMenu: (menu) => (installed = menu) };
  const calls = [];
  installApplicationMenu({
    Menu,
    name: 'LearnTranscriber',
    showMain: () => calls.push('show'),
    openSettings: () => calls.push('settings'),
    hide: () => calls.push('hide'),
    hideAccelerator: 'CommandOrControl+B',
  });
  const [appMenu, edit, window] = installed.template;
  assert.equal(appMenu.label, 'LearnTranscriber');
  assert.deepEqual(
    appMenu.submenu.map((item) => item.label ?? item.role ?? item.type),
    [
      'about',
      'separator',
      'Settings…',
      'separator',
      'Open workspace',
      'Hide all windows',
      'separator',
      'services',
      'separator',
      'hide',
      'hideOthers',
      'unhide',
      'separator',
      'quit',
    ],
  );
  const item = (label) => appMenu.submenu.find((entry) => entry.label === label);
  assert.equal(item('Settings…').accelerator, 'CommandOrControl+,');
  assert.equal(item('Hide all windows').accelerator, 'CommandOrControl+B');
  item('Settings…').click();
  item('Open workspace').click();
  item('Hide all windows').click();
  assert.deepEqual(calls, ['settings', 'show', 'hide']);
  assert.deepEqual([edit.role, window.role], ['editMenu', 'windowMenu']);
});
