const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { elapsedSeconds, formatElapsed } = loadTs('src/features/overlay/listening-clock.ts');

test('elapsed listening time counts whole seconds from the start and is zero before it', () => {
  assert.equal(elapsedSeconds(null, 50_000), 0);
  assert.equal(elapsedSeconds(10_000, 10_999), 0);
  assert.equal(elapsedSeconds(10_000, 75_500), 65);
  assert.equal(elapsedSeconds(10_000, 9_000), 0, 'a clock behind the start never shows negative time');
});

test('the bar timer shows minutes and seconds, and hours after the first hour', () => {
  assert.equal(formatElapsed(0), '00:00');
  assert.equal(formatElapsed(65), '01:05');
  assert.equal(formatElapsed(3599), '59:59');
  assert.equal(formatElapsed(3600), '01:00:00');
  assert.equal(formatElapsed(3 * 3600 + 7 * 60 + 9), '03:07:09');
});
