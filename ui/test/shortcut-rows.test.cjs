// The shortcut editor lists shortcuts with a known action in order, finds the shortcut that already presses some keys, and
// saves or resets one shortcut without touching the others.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { listedShortcuts, shortcutOwner, withOverride, withoutOverride } = loadTs(
  'src/settings/tabs/shortcuts/shortcut-rows.ts',
);
const plain = (value) => JSON.parse(JSON.stringify(value));

const definition = (id, reference, accelerator, enabled = true) => ({ id, reference, accelerator, enabled });
const definitions = [
  definition('capture', 'screenshot', 'CommandOrControl+E'),
  definition('ask', 'execute', 'CommandOrControl+Return'),
  definition('notch', null, 'CommandOrControl+Shift+N', false),
  definition('mic', 'toggleMicCapture', 'CommandOrControl+Shift+D', false),
];

test('the editor lists shortcuts with a known action in their order and leaves local-only shortcuts out', () => {
  assert.deepEqual(plain(listedShortcuts(definitions).map((item) => item.id)), ['ask', 'capture', 'mic']);
});

test('only another enabled shortcut owns some keys', () => {
  assert.equal(shortcutOwner(definitions, 'ask', 'CommandOrControl+E', 'darwin').id, 'capture');
  assert.equal(shortcutOwner(definitions, 'capture', 'CommandOrControl+E', 'darwin'), undefined);
  assert.equal(shortcutOwner(definitions, 'ask', 'CommandOrControl+Shift+D', 'darwin'), undefined);
});

test('one shortcut is changed or reset, and the rest of the saved table stays', () => {
  const saved = { capture: { accelerator: 'CommandOrControl+J', enabled: true } };
  const changed = withOverride(saved, 'ask', { accelerator: 'CommandOrControl+K', enabled: false });
  assert.deepEqual(plain(changed), { ...saved, ask: { accelerator: 'CommandOrControl+K', enabled: false } });
  assert.deepEqual(plain(withoutOverride(changed, 'capture')), {
    ask: { accelerator: 'CommandOrControl+K', enabled: false },
  });
  assert.deepEqual(plain(saved), { capture: { accelerator: 'CommandOrControl+J', enabled: true } });
});
