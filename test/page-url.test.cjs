const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pageOf } = require('../src/main/domain/shared/page-url.cjs');

test('the page of a URL drops its query and fragment', () => {
  assert.equal(pageOf('app://renderer/index.html?window=bar#settings'), 'app://renderer/index.html');
  assert.equal(pageOf('app://renderer/index.html#a?b'), 'app://renderer/index.html');
});

test('a URL with no query or fragment is its own page', () => {
  assert.equal(pageOf('app://renderer/index.html'), 'app://renderer/index.html');
});
