const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appKeptKey } = require('../src/main/domain/settings/app-kept.cjs');

test('each key of the update check bookkeeping is kept by the app', () => {
  for (const key of ['updatesLastCheckAt', 'updatesLastRelease', 'updatesSnoozedUntil', 'updatesSkippedTag'])
    assert.equal(appKeptKey({ overlayOpacity: 0.8, [key]: '' }), key);
});

test('a patch of ordinary settings names no app-kept key', () => {
  assert.equal(appKeptKey({ overlayOpacity: 0.8, assistantId: 'general' }), undefined);
  assert.equal(appKeptKey({}), undefined);
});

test('a patch that is not an object is left for validation to refuse', () => {
  for (const patch of [null, undefined, 'updatesLastRelease', 1]) assert.equal(appKeptKey(patch), undefined);
});
