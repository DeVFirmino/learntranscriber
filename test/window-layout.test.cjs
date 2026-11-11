const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  COLLAPSED_HEIGHT,
  windowFrame,
  resizedPanel,
  nudged,
  insideArea,
} = require('../src/main/domain/windows/layout.cjs');

const display = { x: 0, y: 25, width: 1440, height: 875 };

test('the workspace opens at its default size wherever the system places it', () => {
  assert.deepEqual(windowFrame({ role: 'main', surface: 'panel', display, expandedHeight: 428, barHeight: 132 }), {
    width: 1180,
    height: 850,
    minWidth: 700,
    minHeight: 500,
    x: undefined,
    y: undefined,
    resizable: true,
  });
});

test('the floating panel and bar open at the bottom centre, the panel above the bar', () => {
  const panel = windowFrame({ role: 'overlay', surface: 'panel', display, expandedHeight: 428, barHeight: 200 });
  assert.deepEqual(panel, {
    width: 560,
    height: 428,
    minWidth: 420,
    minHeight: 240,
    x: 440,
    y: 25 + 875 - 16 - (COLLAPSED_HEIGHT + 8 + 428),
    resizable: true,
  });
  const bar = windowFrame({ role: 'overlay', surface: 'bar', display, expandedHeight: 428, barHeight: 200 });
  assert.deepEqual(bar, {
    width: 560,
    height: 200,
    minWidth: 420,
    minHeight: COLLAPSED_HEIGHT,
    x: 440,
    y: 25 + 875 - 16 - 200,
    resizable: false,
  });
});

test('the Notch opens at its own bounds and cannot be resized by the window frame', () => {
  const notch = { x: 600, y: 30, width: 240, height: 48 };
  assert.deepEqual(windowFrame({ role: 'notch', display, notch, expandedHeight: 428, barHeight: 132 }), {
    ...notch,
    minWidth: 84,
    minHeight: 48,
    resizable: false,
  });
});

test('resizing the panel keeps its bottom edge, stays inside the display and respects the minimum size', () => {
  const current = { x: 400, y: 300, width: 560, height: 428 };
  assert.deepEqual(resizedPanel(current, display, 700, 500), { x: 400, y: 228, width: 700, height: 500 });
  assert.deepEqual(resizedPanel(current, display, 100, 100), { x: 400, y: 488, width: 420, height: 240 });
  assert.deepEqual(resizedPanel(current, display, 5000, 5000), { x: 0, y: 25, width: 1440, height: 843 });
});

test('nudging and recovering keep a window inside its display', () => {
  const bounds = { x: 1300, y: 800, width: 200, height: 100 };
  assert.deepEqual(nudged(bounds, display, 50, 50), { x: 1240, y: 800 });
  assert.deepEqual(nudged({ ...bounds, x: 10 }, display, -50, 0), { x: 0, y: 800 });
  assert.deepEqual(insideArea({ x: -200, y: 2000, width: 3000, height: 100 }, display), {
    width: 1440,
    height: 100,
    x: 0,
    y: 800,
  });
});
