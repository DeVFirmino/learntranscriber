const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFINITIONS, shortcutConfig } = require('../src/main/domain/settings/shortcuts.cjs');
const { ShortcutRegistry } = require('../src/main/infrastructure/electron/shortcut-registry.cjs');
const { SHORTCUTS } = require('../src/main/infrastructure/electron/privacy.cjs');
const defaults = require('./fixtures/shortcut-defaults.json');

// Same physical keys: Command-or-Control is Command on a Mac and Return/Enter are one key.
const keys = (accelerator) => {
  const parts = accelerator.split('+');
  const mods = parts.slice(0, -1).map((m) => (m === 'CommandOrControl' ? 'Command' : m));
  return [...mods.sort(), parts.at(-1) === 'Enter' ? 'Return' : parts.at(-1)].join('+');
};

test('the 19 standard shortcut defaults match the maintained contract', () => {
  assert.equal(defaults.length, 19);
  const resolved = shortcutConfig('{}', 'darwin');
  for (const row of defaults) {
    const item = resolved.find((entry) => entry.reference === row.action);
    assert.ok(item, row.action);
    assert.equal(keys(item.accelerator), keys(row.accelerator), row.action);
    assert.equal(item.enabled, row.enabled, row.action);
  }
  // The local additions keep their own defaults.
  assert.deepEqual(
    resolved.filter((item) => !item.reference).map(({ id, accelerator, enabled }) => [id, accelerator, enabled]),
    [
      ['clickThrough', 'CommandOrControl+Shift+I', true],
      ['selection', 'CommandOrControl+Shift+K', true],
      ['notch', 'CommandOrControl+Shift+N', false],
    ],
  );
  assert.deepEqual(SHORTCUTS, {
    hide: 'CommandOrControl+B',
    overlay: 'CommandOrControl+M',
    clickThrough: 'CommandOrControl+Shift+I',
  });
});

test('defaults never collide with each other on any platform', () => {
  for (const platform of ['darwin', 'win32', 'linux']) {
    const all = DEFINITIONS.map((d) => keys(d.accelerator));
    assert.equal(new Set(all).size, all.length, platform);
    assert.doesNotThrow(() =>
      shortcutConfig(JSON.stringify(Object.fromEntries(DEFINITIONS.map((d) => [d.id, { enabled: true }]))), platform),
    );
  }
});

test('a saved shortcut keeps keys a new default now uses; that default stays unregistered', () => {
  // Saved before Command-B became the hide default.
  const saved = JSON.stringify({ capture: { accelerator: 'CommandOrControl+B', enabled: true } });
  const resolved = shortcutConfig(saved, 'darwin');
  assert.equal(resolved.find((item) => item.id === 'capture').accelerator, 'CommandOrControl+B');
  assert.deepEqual(
    (({ enabled, blockedBy }) => ({ enabled, blockedBy }))(resolved.find((item) => item.id === 'hide')),
    { enabled: false, blockedBy: 'capture' },
  );
  const registered = [];
  const registry = new ShortcutRegistry(
    { register: (key) => registered.push(key) > 0, unregister: () => {} },
    () => {},
  );
  const items = registry.configure(saved);
  assert.equal(registered.filter((key) => key === 'CommandOrControl+B').length, 1);
  assert.equal(items.find((item) => item.id === 'hide').registered, false);
  // A disabled saved shortcut does not claim anything.
  const off = shortcutConfig(JSON.stringify({ capture: { accelerator: 'CommandOrControl+B', enabled: false } }));
  assert.equal(off.find((item) => item.id === 'hide').enabled, true);
});

test('the minus key is saved as Electron accepts it; old "Minus" overrides keep working', () => {
  assert.equal(DEFINITIONS.find((d) => d.id === 'opacityDown').accelerator, 'CommandOrControl+Shift+-');
  const legacy = shortcutConfig(
    JSON.stringify({ opacityDown: { accelerator: 'CommandOrControl+Shift+Minus', enabled: true } }),
  );
  assert.equal(legacy.find((item) => item.id === 'opacityDown').accelerator, 'CommandOrControl+Shift+-');
  for (const accelerator of ['Alt+Home', 'CommandOrControl+=', 'Control+numadd', 'CommandOrControl+Enter'])
    assert.doesNotThrow(() => shortcutConfig(JSON.stringify({ ask: { accelerator, enabled: true } })), accelerator);
  assert.throws(
    () =>
      shortcutConfig(
        JSON.stringify({
          ask: { accelerator: 'CommandOrControl+Shift+Enter', enabled: true },
          capture: { accelerator: 'Command+Shift+Return', enabled: true },
        }),
        'darwin',
      ),
    /duplicated/,
  );
  assert.throws(() => shortcutConfig(JSON.stringify({ ask: { accelerator: 'Shift+-', enabled: true } })), /Electron/);
});

test('suspension releases the global keys, ignores queued callbacks and restores the latest saved configuration', () => {
  const registered = new Map(),
    delivered = [],
    published = [];
  const registry = new ShortcutRegistry(
    {
      register: (key, callback) => {
        assert.equal(registered.has(key), false);
        registered.set(key, callback);
        return true;
      },
      unregister: (key) => registered.delete(key),
    },
    (action) => delivered.push(action),
    (status) => published.push({ ...status }),
  );
  registry.configure('{}');
  const queued = registered.get('CommandOrControl+D');
  assert.ok(registered.size > 0);
  registry.setSuspended(true);
  assert.equal(registered.size, 0);
  assert.ok(Object.values(published.at(-1)).every((value) => value === false));
  queued();
  assert.deepEqual(delivered, []);
  const count = published.length;
  registry.setSuspended(true);
  assert.equal(published.length, count);
  registry.configure(JSON.stringify({ record: { accelerator: 'Alt+F8' }, capture: { enabled: false } }));
  assert.equal(registered.size, 0, 'editing Settings never reclaims keys while suspended');
  registry.setSuspended(false);
  assert.equal(registered.has('CommandOrControl+D'), false);
  assert.equal(registered.has('CommandOrControl+E'), false);
  assert.equal(registered.has('Alt+F8'), true);
  registered.get('Alt+F8')();
  assert.deepEqual(delivered, ['record']);
  const resumed = published.length;
  registry.setSuspended(false);
  assert.equal(published.length, resumed);
  registry.close();
  assert.equal(registered.size, 0);
});

test('Escape is registered only for visible bar state and queued callbacks respect suspension', () => {
  const callbacks = new Map(),
    unregistered = [];
  const sent = [];
  const registry = new ShortcutRegistry(
    {
      register: (key, fn) => {
        callbacks.set(key, fn);
        return true;
      },
      unregister: (key) => unregistered.push(key),
    },
    (id) => sent.push(id),
  );
  registry.configure('{}');
  assert.equal(callbacks.has('Escape'), false);
  registry.setEscapeEnabled(true);
  const escape = callbacks.get('Escape');
  escape();
  assert.deepEqual(sent, ['escape']);
  registry.setSuspended(true);
  escape();
  assert.deepEqual(sent, ['escape']);
  assert.ok(unregistered.includes('Escape'));
  registry.setSuspended(false);
  registry.setEscapeEnabled(false);
  escape();
  assert.deepEqual(sent, ['escape']);
  registry.close();
});
