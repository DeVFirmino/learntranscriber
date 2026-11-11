const { test } = require('node:test');
const assert = require('node:assert/strict');
const { privacyStatus } = require('../src/main/application/settings/privacy-status.cjs');

const privacy = { status: () => ({ concealed: false, platform: 'darwin' }) };
const accelerators = { hide: 'CommandOrControl+B', overlay: 'CommandOrControl+M' };

test('the privacy panel carries the restore shortcuts and the menu bar icon state', () => {
  const status = privacyStatus({
    privacy,
    settings: { showMenuBarIcon: true },
    shortcutStatus: { hide: true },
    accelerator: (id) => accelerators[id],
    menuBarIconVisible: true,
  });
  assert.deepEqual(status, {
    concealed: false,
    platform: 'darwin',
    shortcutStatus: { hide: true },
    shortcuts: { hide: 'CommandOrControl+B', overlay: 'CommandOrControl+M', clickThrough: '' },
    menuBarIconVisible: true,
    menuBarRecoveryFallback: false,
  });
});

test('a hidden menu bar icon stays as the fallback while the hide shortcut is not registered', () => {
  const status = (registered) =>
    privacyStatus({
      privacy,
      settings: { showMenuBarIcon: false },
      shortcutStatus: { hide: registered },
      accelerator: () => undefined,
      menuBarIconVisible: !registered,
    }).menuBarRecoveryFallback;
  assert.equal(status(false), true);
  assert.equal(status(true), false);
});
