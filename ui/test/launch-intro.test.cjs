const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { introDone, INTRO_MIN_MS, INTRO_MAX_MS } = loadTs('src/features/overlay/launch-intro.ts');

test('the launch intro waits for the app and a minimum time, but never past the cap', () => {
  assert.equal(introDone(0, true), false);
  assert.equal(introDone(INTRO_MIN_MS - 1, true), false);
  assert.equal(introDone(INTRO_MIN_MS, true), true);
  assert.equal(introDone(INTRO_MAX_MS - 1, false), false);
  assert.equal(introDone(INTRO_MAX_MS, false), true);
});

test('the ready launch keeps its logo visible for the requested extra second', () => {
  assert.equal(introDone(1899, true), false);
  assert.equal(introDone(1900, true), true);
});
