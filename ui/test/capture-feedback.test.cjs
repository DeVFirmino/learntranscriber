const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { contextApi } = loadTs('src/bridge/mock/context.ts');

test('preview capture publishes completion after the image resolves and unsubscribes cleanly', async () => {
  let finish;
  const api = contextApi({
    state: {},
    selections: {},
    previewPng: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const states = [];
  const unsubscribe = api.onCaptureState((value) => states.push(value.phase));
  const capture = api.capture();
  assert.deepEqual(states, ['capturing']);
  finish('data:image/png;base64,AAAA');
  assert.equal(await capture, 'data:image/png;base64,AAAA');
  assert.deepEqual(states, ['capturing', 'captured']);
  unsubscribe();
  const again = api.capture();
  finish('image');
  await again;
  assert.deepEqual(states, ['capturing', 'captured']);
});

test('preview capture reports asynchronous failures and preserves the original error', async () => {
  const api = contextApi({
    state: {},
    selections: {},
    previewPng: async () => {
      throw new Error('No display');
    },
  });
  const states = [];
  api.onCaptureState((value) => states.push(value.phase));
  await assert.rejects(api.capture(), /No display/);
  assert.deepEqual(states, ['capturing', 'error']);
});
