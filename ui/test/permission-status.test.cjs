// Permission and speech status are read from raw strings/booleans, and a restart is needed while any is missing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { readPermissionsStatus, readSpeechStatus, needsRestart } = loadTs(
  'src/settings/tabs/permissions/permission-status.ts',
);
const plain = (value) => JSON.parse(JSON.stringify(value));

test('permissions read granted only from the exact "granted" string, accessibility from its boolean', () => {
  assert.deepEqual(
    plain(readPermissionsStatus({ permissions: { microphone: 'granted', screen: 'denied', accessibility: true } })),
    { microphone: true, screen: false, accessibility: true },
  );
});

test('a missing state reads as nothing granted', () => {
  assert.deepEqual(plain(readPermissionsStatus(null)), { microphone: false, screen: false, accessibility: false });
  assert.deepEqual(plain(readPermissionsStatus(undefined)), { microphone: false, screen: false, accessibility: false });
});

test('speech authorization maps to authorized, and denied or restricted both read as denied', () => {
  assert.deepEqual(plain(readSpeechStatus('authorized')), { authorized: true, denied: false });
  assert.deepEqual(plain(readSpeechStatus('denied')), { authorized: false, denied: true });
  assert.deepEqual(plain(readSpeechStatus('restricted')), { authorized: false, denied: true });
  assert.deepEqual(plain(readSpeechStatus('notDetermined')), { authorized: false, denied: false });
});

test('a restart is needed until every permission is granted', () => {
  assert.equal(needsRestart({ microphone: false, screen: true, accessibility: true }), true);
  assert.equal(needsRestart({ microphone: true, screen: true, accessibility: true }), false);
});
