// An update downloads only this repository's DMG for a real release tag, and is checked against the SHA-256 the
// release publishes for that exact file.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DMG_NAME,
  updateAssetUrls,
  checksumFor,
  updateFileName,
} = require('../src/main/domain/updates/update-asset.cjs');

const SLUG = 'DeVFirmino/learntranscriber';
const DIGEST = 'ad86974f6205178b541a232af4c287f8e27f37985752b5900f3430eb5ad176ee';

test('a release tag names its DMG and checksum in the given repository', () => {
  assert.deepEqual(updateAssetUrls(SLUG, 'v0.2.0'), {
    dmg: 'https://github.com/DeVFirmino/learntranscriber/releases/download/v0.2.0/LearnTranscriber-arm64.dmg',
    checksum:
      'https://github.com/DeVFirmino/learntranscriber/releases/download/v0.2.0/LearnTranscriber-arm64.dmg.sha256',
  });
});

test('anything that is not a release tag has no assets', () => {
  for (const tag of ['', '../evil', 'v1/../../x', 'https://example.com', null, 'v1.0 2']) {
    assert.equal(updateAssetUrls(SLUG, tag), null, String(tag));
  }
});

test('the checksum file gives the digest for the DMG, in either shasum form', () => {
  assert.equal(checksumFor(`${DIGEST}  ${DMG_NAME}\n`, DMG_NAME), DIGEST);
  assert.equal(checksumFor(`${DIGEST.toUpperCase()} *${DMG_NAME}`, DMG_NAME), DIGEST);
  assert.equal(checksumFor(`${'0'.repeat(64)}  other.dmg\n${DIGEST}  ${DMG_NAME}`, DMG_NAME), DIGEST);
});

test('a checksum for another file, a short digest or an empty file gives nothing', () => {
  assert.equal(checksumFor(`${DIGEST}  other.dmg`, DMG_NAME), null);
  assert.equal(checksumFor(`${DIGEST.slice(1)}  ${DMG_NAME}`, DMG_NAME), null);
  assert.equal(checksumFor('', DMG_NAME), null);
});

test('the saved file carries its version and nothing that could leave the folder', () => {
  assert.equal(updateFileName('0.2.0'), 'LearnTranscriber-0.2.0-arm64.dmg');
  assert.equal(updateFileName('../../0.2'), 'LearnTranscriber-....0.2-arm64.dmg');
});
