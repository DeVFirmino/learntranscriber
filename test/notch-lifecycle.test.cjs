const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createNotchWindow, initialNotchBounds } = require('../src/main/infrastructure/electron/notch-lifecycle.cjs');
const { notchBounds } = require('../src/main/domain/notch/geometry.cjs');

const primary = { x: 0, y: 25, width: 1440, height: 875 };
const second = { x: 1440, y: 0, width: 1920, height: 1080 };
const saved = { notchX: 1600, notchY: 10, notchWidth: 240, notchHeight: 48, notchPinned: false };

test('the Notch opens on the display holding its saved position, or the primary one while pinned', () => {
  const screen = { getDisplayMatching: () => ({ workArea: second }) };
  assert.deepEqual(initialNotchBounds(screen, saved, primary), notchBounds(saved, second, false));
  const pinned = { ...saved, notchPinned: true };
  assert.deepEqual(initialNotchBounds(screen, pinned, primary), notchBounds(pinned, primary, false));
});

function harness() {
  const calls = [];
  let settings = { ...saved, notchEnabled: true },
    sessionId = 's1',
    concealed = false,
    expanded = false;
  const window = {
    destroyed: false,
    isDestroyed() {
      return this.destroyed;
    },
    getBounds: () => ({ x: 1600, y: 10, width: 240, height: 48 }),
    setBounds: (bounds) => calls.push(['setBounds', bounds]),
    webContents: { isLoadingMainFrame: () => false },
  };
  const notch = createNotchWindow({
    create: (role) => (calls.push(['create', role]), window),
    open: (value) => Boolean(value && !value.isDestroyed()),
    screen: { getDisplayMatching: () => ({ workArea: second }) },
    settings: () => settings,
    active: { id: () => sessionId },
    notchState: {
      expanded: () => expanded,
      setExpanded: (value) => {
        expanded = value;
        calls.push(['expanded', value]);
      },
      resetExpanded: () => {
        expanded = false;
        calls.push(['reset']);
      },
    },
    privacy: () => ({
      concealed,
      show: (value) => calls.push(['show', value === window]),
      hide: (value) => calls.push(['hide', value === window]),
    }),
    changed: () => calls.push(['changed']),
  });
  return {
    notch,
    window,
    calls,
    set: (next) => {
      settings = { ...settings, ...next.settings };
      if ('sessionId' in next) sessionId = next.sessionId;
      if ('concealed' in next) concealed = next.concealed;
    },
  };
}

test('the Notch window exists only while it is enabled and a session is live', () => {
  const h = harness();
  h.notch.sync();
  assert.deepEqual(h.calls, [['reset'], ['create', 'notch'], ['hide', true]]);
  assert.equal(h.notch.window(), h.window);
  h.calls.length = 0;
  h.set({ sessionId: null });
  h.notch.sync();
  assert.deepEqual(h.calls, [['hide', true]]);
  h.calls.length = 0;
  h.set({ sessionId: 's2', concealed: true });
  h.notch.sync();
  assert.deepEqual(h.calls, [['hide', true]], 'the retired collapsed launcher stays hidden');
});

test('expanding the Notch records it and resizes an open window in place', () => {
  const h = harness();
  h.notch.setExpanded(true);
  assert.deepEqual(h.calls, [['expanded', true]], 'nothing to resize before the window exists');
  h.notch.sync();
  h.calls.length = 0;
  h.notch.setExpanded(true);
  assert.deepEqual(h.calls, [
    ['expanded', true],
    ['setBounds', notchBounds({ ...saved, notchEnabled: true }, second, true)],
    ['show', true],
    ['changed'],
  ]);
});

test('collapsing hides the retired Ask launcher and an insight can open the panel again', () => {
  const h = harness();
  h.notch.sync();
  h.notch.setExpanded(true);
  h.calls.length = 0;
  h.notch.setExpanded(false);
  assert.ok(h.calls.some(([event]) => event === 'hide'));
  assert.ok(!h.calls.some(([event]) => event === 'show'));
  h.calls.length = 0;
  h.notch.sync();
  assert.deepEqual(h.calls, [['hide', true]]);
  h.notch.setExpanded(true);
  assert.ok(h.calls.some(([event]) => event === 'show'));
});
