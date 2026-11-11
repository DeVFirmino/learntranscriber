const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { paginationPages } = loadTs('src/features/pagination-pages.ts');

test('pagination keeps beginning, middle and end pages reachable in large libraries', () => {
  assert.deepEqual(Array.from(paginationPages(1, 20)), [1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(paginationPages(9, 20)), [7, 8, 9, 10, 11]);
  assert.deepEqual(Array.from(paginationPages(20, 20)), [16, 17, 18, 19, 20]);
});

test('pagination handles empty and small libraries without nonexistent pages', () => {
  assert.deepEqual(Array.from(paginationPages(1, 0)), []);
  assert.deepEqual(Array.from(paginationPages(1, 1)), [1]);
  assert.deepEqual(Array.from(paginationPages(3, 3)), [1, 2, 3]);
});
