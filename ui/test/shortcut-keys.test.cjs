const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const keys = loadTs('src/features/shortcut-keys.ts');
const { recordedAccelerator, comparisonKey } = keys;
// Copied out of the module's VM context so strict deep equality compares plain objects.
const shortcutConflicts = (...args) => ({ ...keys.shortcutConflicts(...args) });
const press = (key, code, mods = {}) => ({
  key,
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

test('recording uses physical keys, so minus, equals and Alt letters keep their Electron names', () => {
  assert.equal(recordedAccelerator(press('_', 'Minus', { metaKey: true, shiftKey: true })), 'CommandOrControl+Shift+-');
  assert.equal(
    recordedAccelerator(press('+', 'Equal', { metaKey: true, shiftKey: true })),
    'CommandOrControl+Shift+Plus',
  );
  assert.equal(recordedAccelerator(press('=', 'Equal', { metaKey: true })), 'CommandOrControl+=');
  assert.equal(recordedAccelerator(press('å', 'KeyA', { altKey: true })), 'Alt+A');
  assert.equal(recordedAccelerator(press('Enter', 'Enter', { metaKey: true })), 'CommandOrControl+Return');
  assert.equal(
    recordedAccelerator(press('ArrowLeft', 'ArrowLeft', { metaKey: true, shiftKey: true })),
    'CommandOrControl+Shift+Left',
  );
  assert.equal(recordedAccelerator(press('b', 'KeyB')), null, 'a modifier is required');
  assert.equal(recordedAccelerator(press('Meta', 'MetaLeft', { metaKey: true })), null);
});

test('comparison treats Command-or-Control, Return/Enter and the old Minus name as the same keys', () => {
  assert.equal(
    comparisonKey('CommandOrControl+Shift+Enter', 'darwin'),
    comparisonKey('Shift+Command+Return', 'darwin'),
  );
  assert.equal(comparisonKey('CommandOrControl+Shift+Minus', 'darwin'), comparisonKey('Command+Shift+-', 'darwin'));
  assert.notEqual(comparisonKey('CommandOrControl+B', 'win32'), comparisonKey('Command+B', 'win32'));
});

test('an edited shortcut cannot take keys another action uses; saved claims stay savable', () => {
  const definitions = [
    { id: 'hide', accelerator: 'CommandOrControl+B', enabled: true },
    { id: 'capture', accelerator: 'CommandOrControl+E', enabled: true },
    { id: 'notch', accelerator: 'CommandOrControl+Shift+N', enabled: false },
  ];
  assert.deepEqual(
    shortcutConflicts(definitions, { capture: { accelerator: 'Command+B', enabled: true } }, {}, 'darwin'),
    { capture: 'hide' },
  );
  // A disabled action does not hold its keys.
  assert.deepEqual(
    shortcutConflicts(
      definitions,
      { capture: { accelerator: 'CommandOrControl+Shift+N', enabled: true } },
      {},
      'darwin',
    ),
    {},
  );
  // Saved before the default changed: the main process already gave capture the keys and blocked hide.
  const resolved = [{ ...definitions[0], enabled: false, blockedBy: 'capture' }, definitions[1], definitions[2]];
  const saved = { capture: { accelerator: 'CommandOrControl+B', enabled: true } };
  assert.deepEqual(
    shortcutConflicts(resolved, { ...saved, notch: { accelerator: 'Alt+N', enabled: true } }, saved, 'darwin'),
    {},
  );
});
