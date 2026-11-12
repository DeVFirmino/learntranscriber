// The floating bar grows upward for its session rows and an open popover, keeping its bottom edge, and holds still
// while every window is concealed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBarSize } = require('../src/main/infrastructure/electron/bar-size.cjs');
const { COLLAPSED_HEIGHT, BAR_POPOVER_HEIGHT } = require('../src/main/domain/windows/layout.cjs');

function fakeBar(bounds) {
  return {
    bounds,
    getBounds() {
      return { ...this.bounds };
    },
    setBounds(next) {
      this.bounds = next;
    },
  };
}

const sizeWith = (concealed = false) =>
  createBarSize({ privacy: () => ({ concealed }), settings: () => ({}), active: { id: () => null } });

test('an open popover grows the bar upward and keeps its bottom edge', () => {
  const size = sizeWith();
  const bar = fakeBar({ x: 10, y: 700, width: 400, height: COLLAPSED_HEIGHT });
  size.setPopoverOpen(true);
  size.sync(bar, { panelExpanded: false, capturing: false });
  assert.equal(bar.bounds.height, COLLAPSED_HEIGHT + BAR_POPOVER_HEIGHT);
  assert.equal(bar.bounds.y + bar.bounds.height, 700 + COLLAPSED_HEIGHT);
  assert.equal(bar.bounds.x, 10);
  size.setPopoverOpen(false);
  size.sync(bar, { panelExpanded: false, capturing: false });
  assert.deepEqual(bar.bounds, { x: 10, y: 700, width: 400, height: COLLAPSED_HEIGHT });
});

test('nothing changes while every window is concealed', () => {
  const size = sizeWith(true);
  const bar = fakeBar({ x: 0, y: 500, width: 400, height: COLLAPSED_HEIGHT });
  size.setPopoverOpen(true);
  size.sync(bar, { panelExpanded: false, capturing: true });
  assert.equal(bar.bounds.height, COLLAPSED_HEIGHT);
});

test('without a bar window only the rows are recorded', () => {
  const size = sizeWith();
  size.sync(null, { panelExpanded: false, capturing: false });
  assert.equal(typeof size.rows(), 'object');
});
