// A bar popup mounts only after the grown window reaches the page, however many frames the native resize takes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

// A page whose height changes after `resizeAt` frames (never, when null), counting the frames it is asked for.
function page(resizeAt) {
  const window = { innerHeight: 52 };
  let frames = 0;
  const requestAnimationFrame = (callback) => {
    frames += 1;
    if (frames === resizeAt) window.innerHeight = 220;
    queueMicrotask(callback);
  };
  const { afterNativeResize, RESIZE_FRAMES } = loadTs('src/features/overlay/native-resize.ts', {
    window,
    requestAnimationFrame,
  });
  return { afterNativeResize, RESIZE_FRAMES, frames: () => frames };
}

test('waits past a slow native resize, then one more frame for its resize event', async () => {
  const slow = page(6);
  await slow.afterNativeResize(52);
  assert.equal(slow.frames(), 7);
});

test('a height that already changed waits only one frame', async () => {
  const done = page(null);
  await done.afterNativeResize(220);
  assert.equal(done.frames(), 1);
});

test('a window whose size never changes stops waiting after the frame limit', async () => {
  const stuck = page(null);
  await stuck.afterNativeResize(52);
  assert.equal(stuck.frames(), stuck.RESIZE_FRAMES + 1);
});
