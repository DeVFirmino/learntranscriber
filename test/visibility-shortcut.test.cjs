const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createVisibilityShortcut } = require('../src/main/domain/overlay/visibility-shortcut.cjs');
function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let hidden = false;
  const fades = [],
    toggles = [];
  const controller = createVisibilityShortcut({
    concealed: () => hidden,
    toggle: () => {
      hidden = !hidden;
      toggles.push(hidden);
    },
    fade: (value) => fades.push(value),
    timers: { setTimeout, clearTimeout },
  });
  t.after(() => controller.cancel());
  return { controller, fades, toggles, hide: () => (hidden = true) };
}
test('visibility tap waits 650ms and restore is immediate while concealed', (t) => {
  const f = fixture(t);
  f.controller.press();
  t.mock.timers.tick(649);
  assert.deepEqual(f.toggles, []);
  t.mock.timers.tick(1);
  assert.deepEqual(f.toggles, [true]);
  f.controller.press();
  assert.deepEqual(f.toggles, [true, false]);
});
test('visibility repeats fade only the panel and restore opacity without concealing', (t) => {
  const f = fixture(t);
  f.controller.press();
  t.mock.timers.tick(300);
  f.controller.press();
  assert.deepEqual(f.fades, [0.85]);
  for (let i = 0; i < 12; i++) {
    t.mock.timers.tick(50);
    f.controller.press();
  }
  assert.equal(f.fades.at(-1), 0.25);
  t.mock.timers.tick(239);
  assert.deepEqual(f.toggles, []);
  t.mock.timers.tick(1);
  assert.equal(f.fades.at(-1), null);
  assert.deepEqual(f.toggles, []);
});
test('suspension or teardown cancels pending visibility actions and restores a held panel', (t) => {
  const f = fixture(t);
  f.controller.press();
  f.controller.cancel();
  t.mock.timers.tick(1000);
  assert.deepEqual(f.toggles, []);
  f.controller.press();
  f.controller.press();
  f.controller.cancel();
  assert.deepEqual(f.fades, [0.85, null]);
  t.mock.timers.tick(1000);
  assert.deepEqual(f.toggles, []);
});
