const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notchStatus } = require('../src/main/application/notch/status.cjs');

const state = {
  expanded: () => true,
  status: (activeId) => ({ pending: null, displayed: activeId ? { id: 'insight' } : null }),
};

test('an open Notch reports its visibility and bounds with the live session presentation', () => {
  const window = { open: () => true, visible: () => true, bounds: () => ({ x: 1, y: 2, width: 3, height: 4 }) };
  assert.deepEqual(notchStatus({ state, activeId: 's1', window, pinned: false }), {
    expanded: true,
    visible: true,
    pending: null,
    displayed: { id: 'insight' },
    bounds: { x: 1, y: 2, width: 3, height: 4 },
    pinned: false,
  });
});

test('a closed Notch is invisible and has no bounds, without touching its window', () => {
  const window = {
    open: () => false,
    visible: () => assert.fail('a closed window is not read'),
    bounds: () => assert.fail('a closed window is not read'),
  };
  const status = notchStatus({ state, activeId: null, window, pinned: true });
  assert.equal(status.visible, false);
  assert.equal(status.bounds, null);
  assert.equal(status.pinned, true);
});
