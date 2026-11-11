const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { notarizationBlockers } = require('../scripts/signing/notarization-preflight.cjs');
const APP = '/Fixture.app';
const ready = { signed: true, executable: true, hardenedRuntime: true, timestamped: true, debuggable: false };
const library = { ...ready, executable: false, hardenedRuntime: false };
function preflight(signatures, options = {}) {
  return notarizationBlockers(APP, {
    binaries: () => Object.keys(signatures).map((name) => path.join(APP, name)),
    signatureOf: (file) => signatures[path.relative(APP, file)],
    verify: () => true,
    ...options,
  });
}
test('a release-signed app has no notarization blockers, and libraries need no hardened runtime', () => {
  assert.deepEqual(preflight({ 'Contents/MacOS/App': ready, 'Contents/Frameworks/libcore.dylib': library }), []);
});
test('every notarization requirement is reported for the binary that misses it', () => {
  const blockers = preflight(
    {
      'Contents/MacOS/App': { ...ready, hardenedRuntime: false, timestamped: false, debuggable: true },
      'Contents/Resources/native/helper': { signed: false },
    },
    { verify: () => false },
  );
  assert.deepEqual(blockers, [
    'Contents/MacOS/App: hardened runtime is off',
    'Contents/MacOS/App: no secure timestamp',
    'Contents/MacOS/App: get-task-allow entitlement',
    'Contents/Resources/native/helper: not signed',
    'codesign --verify --deep --strict failed',
  ]);
});
test('a local rehearsal may skip the secure timestamp but never the hardened runtime', () => {
  const local = { ...ready, timestamped: false };
  const blockers = preflight(
    { 'Contents/MacOS/App': local, 'Contents/Resources/native/helper': { ...local, hardenedRuntime: false } },
    { requireTimestamp: false },
  );
  assert.deepEqual(blockers, ['Contents/Resources/native/helper: hardened runtime is off']);
});
