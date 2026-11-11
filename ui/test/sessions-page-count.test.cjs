// Pagination math for the sessions list: page count rounds up and never drops below one, and the last page index
// clamps a stale page after the result set shrinks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { pageCount, lastPageIndex } = loadTs('src/features/sessions/page-count.ts');

test('an empty or partial result is still one page', () => {
  assert.equal(pageCount(0, 20), 1);
  assert.equal(pageCount(5, 20), 1);
});

test('a result that spans exact or partial extra pages rounds up', () => {
  assert.equal(pageCount(40, 20), 2);
  assert.equal(pageCount(41, 20), 3);
});

test('the last page index is zero-based and never negative', () => {
  assert.equal(lastPageIndex(0, 20), 0);
  assert.equal(lastPageIndex(20, 20), 0);
  assert.equal(lastPageIndex(21, 20), 1);
});
