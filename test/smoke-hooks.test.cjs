const { test } = require('node:test');
const assert = require('node:assert/strict');
const { smokeHooks } = require('../src/main/smoke-hooks.cjs');

test('the smoke runs with the composed internals and its own hooks', async () => {
  let context, expanded;
  const active = { id: null, set: (id) => (active.id = id) };
  const hooks = smokeHooks({ run: async (value) => (context = value) });
  await hooks.run({
    repositories: 'repositories',
    windows: {
      main: () => 'main',
      create: (role) => `window:${role}`,
      setNotchExpanded: (value) => {
        expanded = value;
      },
    },
    notchState: { snapshot: () => ({ displayed: null }) },
    active,
  });
  assert.equal(context.repositories, 'repositories');
  assert.equal(context.mainWindow, 'main');
  assert.equal(context.createWindow('overlay'), 'window:overlay');
  assert.deepEqual(context.getNotchDisplay(), { displayed: null });
  context.setActive('s1');
  assert.equal(active.id, 's1');
  context.expandNotch(true);
  assert.equal(expanded, true);
  assert.equal('windows' in context, false);
});

test('a substitute capture replaces screenshots until it is restored, nesting in order', async () => {
  let context;
  const hooks = smokeHooks({ run: async (value) => (context = value) });
  const screenshot = hooks.screenshot(() => 'real');
  await hooks.run({ windows: { main: () => null }, notchState: {}, active: {} });
  assert.equal(screenshot(), 'real');
  const restoreOuter = context.setCapture(() => 'outer');
  const restoreInner = context.setCapture(() => 'inner');
  assert.equal(screenshot(), 'inner');
  restoreInner();
  assert.equal(screenshot(), 'outer');
  restoreOuter();
  assert.equal(screenshot(), 'real');
});
