const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shortcutDefinitions } = require('../src/main/application/settings/shortcut-definitions.cjs');

test('each shortcut carries its registration and its defaults beside a custom key', () => {
  const saved = JSON.stringify({ hide: { accelerator: 'CommandOrControl+Shift+H', enabled: false } });
  const items = shortcutDefinitions(saved, { overlay: true }, 'darwin');
  const hide = items.find((item) => item.id === 'hide'),
    overlay = items.find((item) => item.id === 'overlay');
  assert.deepEqual(
    [hide.accelerator, hide.enabled, hide.registered, hide.defaultAccelerator, hide.defaultEnabled],
    ['CommandOrControl+Shift+H', false, false, 'CommandOrControl+B', true],
  );
  assert.deepEqual(
    [overlay.accelerator, overlay.registered, overlay.defaultAccelerator],
    ['CommandOrControl+M', true, 'CommandOrControl+M'],
  );
});

test('an invalid saved configuration is refused as in the settings rules', () => {
  assert.throws(() => shortcutDefinitions(JSON.stringify({ unknown: {} }), {}, 'darwin'), /Unknown shortcut action/);
});
