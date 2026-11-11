const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nativeHelperPaths } = require('../src/main/infrastructure/electron/native-helper-paths.cjs');

test('helpers resolve to the packaged resources or the local development build', () => {
  const packaged = nativeHelperPaths({ packaged: true, resourcesPath: '/App/Resources', root: '/repo' });
  const local = nativeHelperPaths({ packaged: false, resourcesPath: undefined, root: '/repo' });
  assert.equal(packaged('system-audio'), '/App/Resources/native/system-audio');
  assert.equal(local('context-helper'), '/repo/.local/native/context-helper');
});
