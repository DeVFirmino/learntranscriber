const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

test('mock show floating is idempotent and preserves listening and expansion state', async () => {
  const calls = [];
  const { windowsApi } = loadTs('src/bridge/mock/windows.ts');
  const state = { overlayExpanded: true, listening: false };
  const api = windowsApi({ state, setOverlay: (visible) => calls.push(visible) });
  assert.equal(await api.showOverlay(), true);
  assert.equal(await api.showOverlay(), true);
  assert.deepEqual(calls, [true, true]);
  assert.deepEqual(state, { overlayExpanded: true, listening: false });
});
