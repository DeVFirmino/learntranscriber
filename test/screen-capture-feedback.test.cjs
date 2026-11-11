const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createScreenCapture } = require('../src/main/application/context/screen-capture.cjs');

test('capture progress surrounds the real capture and overlapping requests share its result', async () => {
  const states = [];
  let finish;
  let calls = 0;
  const capture = createScreenCapture({
    captureImage: () => {
      calls += 1;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    changed: (value) => states.push(value.phase),
  });
  const first = capture.capture();
  const second = capture.capture();
  assert.equal(first, second);
  assert.deepEqual(states, ['capturing']);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish('data:image/png;base64,AAAA');
  assert.equal(await first, 'data:image/png;base64,AAAA');
  assert.deepEqual(states, ['capturing', 'captured']);
});

test('capture failure is published and a later attempt can succeed', async () => {
  const states = [];
  let fail = true;
  const capture = createScreenCapture({
    captureImage: async () => {
      if (fail) throw new Error('Permission denied');
      return 'image';
    },
    changed: (value) => states.push(value.phase),
  });
  await assert.rejects(capture.capture(), /Permission denied/);
  fail = false;
  assert.equal(await capture.capture(), 'image');
  assert.deepEqual(states, ['capturing', 'error', 'capturing', 'captured']);
});
