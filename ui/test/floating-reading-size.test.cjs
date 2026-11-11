const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { floatingFontScale, floatingFontSize } = loadTs('src/features/overlay/reading-size.ts');
test('legacy small scales cannot shrink reading below 18px', () => {
  for (const value of [0.7, 0.8, 1, NaN]) assert.equal(floatingFontSize(value), 18);
  assert.equal(floatingFontSize(1.5), 27);
  assert.equal(floatingFontScale(5), 1.6);
});
