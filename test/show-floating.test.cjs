const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerWindows } = require('../src/main/interface/ipc/windows.cjs');

test('show floating always shows instead of toggling or starting audio', () => {
  const handlers = new Map();
  let visible = false;
  const windows = {
    showOverlay: () => {
      visible = true;
    },
    toggleOverlay: () => assert.fail('Opening must never toggle an already visible bar'),
    setListening: () => assert.fail('Showing a window must not start listening'),
  };
  registerWindows((name, callback) => handlers.set(name, callback), { windows });
  const show = handlers.get('overlay:show');
  assert.equal(show(), true);
  assert.equal(visible, true);
  assert.equal(show(), true);
  assert.equal(visible, true);
});

test('onboarding presentation validates its flag and keeps the requesting window identity', () => {
  const handlers = new Map();
  const calls = [];
  const caller = { id: 'panel' };
  registerWindows((name, callback) => handlers.set(name, callback), {
    callers: { windowOf: (event) => event.sender },
    windows: { presentOnboarding: (window, active) => calls.push([window, active]) },
  });
  const present = handlers.get('overlay:onboarding');
  assert.throws(() => present({ sender: caller }, 'yes'), /Invalid onboarding presentation/);
  assert.equal(present({ sender: caller }, true), true);
  assert.equal(present({ sender: caller }, false), true);
  assert.deepEqual(calls, [
    [caller, true],
    [caller, false],
  ]);
});
