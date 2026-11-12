// The update banner follows one download from start to a verified DMG, and opens only that DMG.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUpdateInstall } = require('../src/main/application/updates/update-install.cjs');

function harness(download) {
  const opened = [];
  let changes = 0;
  const install = createUpdateInstall({
    download,
    openFile: async (file) => opened.push(file),
    changed: () => changes++,
  });
  return { install, opened, changes: () => changes };
}

test('a download reports progress, then is ready and opens its file', async () => {
  const { install, opened } = harness(async (tag, version, onProgress) => {
    onProgress(0.5);
    return `/Downloads/LearnTranscriber-${version}-arm64.dmg`;
  });
  assert.deepEqual(install.state('v2.0.0'), { phase: 'idle', progress: null, error: null });
  await install.start('v2.0.0', '2.0.0');
  assert.deepEqual(install.state('v2.0.0'), { phase: 'ready', progress: 1, error: null });
  assert.equal(await install.open('v2.0.0'), true);
  assert.deepEqual(opened, ['/Downloads/LearnTranscriber-2.0.0-arm64.dmg']);
});

test('a failed download keeps its reason and opens nothing', async () => {
  const { install, opened } = harness(async () => {
    throw new Error('The downloaded update does not match its published checksum, so it was deleted.');
  });
  await install.start('v2.0.0', '2.0.0');
  assert.equal(install.state('v2.0.0').phase, 'failed');
  assert.match(install.state('v2.0.0').error, /checksum/);
  assert.equal(await install.open('v2.0.0'), false);
  assert.deepEqual(opened, []);
});

test('another release shows as not downloaded, and a second start while one runs is ignored', async () => {
  let finish;
  let calls = 0;
  const { install } = harness(() => {
    calls++;
    return new Promise((resolve) => (finish = resolve));
  });
  const first = install.start('v2.0.0', '2.0.0');
  assert.equal(install.state('v2.0.0').phase, 'downloading');
  assert.equal(install.state('v3.0.0').phase, 'idle');
  await install.start('v2.0.0', '2.0.0');
  await install.start('v3.0.0', '3.0.0');
  assert.equal(calls, 1);
  finish('/Downloads/a.dmg');
  await first;
  assert.equal(await install.open('v3.0.0'), false);
});
