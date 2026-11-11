const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseVersion, compareVersions, isNewerRelease } = require('../src/main/domain/updates/release-version.cjs');

test('a version parses as dotted numbers, a leading v and a pre-release suffix ignored', () => {
  assert.deepEqual(parseVersion('1.4.0'), [1, 4, 0]);
  assert.deepEqual(parseVersion('v1.4.0'), [1, 4, 0]);
  assert.deepEqual(parseVersion('V2.0'), [2, 0]);
  assert.deepEqual(parseVersion('1.4.0-beta.1'), [1, 4, 0]);
  assert.deepEqual(parseVersion('v1.4.0+build5'), [1, 4, 0]);
});

test('a tag that is not a version, or is not a string, never parses', () => {
  for (const tag of ['latest', 'v', '', '1.x.0', '1..0', '-beta', null, undefined, 42])
    assert.equal(parseVersion(tag), null, JSON.stringify(tag));
});

test('versions compare component by component, padding a missing trailing component with zero', () => {
  assert.equal(compareVersions([1, 4, 0], [1, 4, 0]), 0);
  assert.equal(compareVersions([1, 4], [1, 4, 0]), 0);
  assert.equal(compareVersions([1, 5, 0], [1, 4, 9]), 1);
  assert.equal(compareVersions([1, 4, 0], [1, 5, 0]), -1);
  assert.equal(compareVersions([2, 0], [1, 9, 9]), 1);
});

const release = (tagName, extra = {}) => ({ tagName, draft: false, prerelease: false, ...extra });

test('a release counts only when its base version is newer than the one running', () => {
  assert.equal(isNewerRelease(release('v1.5.0'), '1.4.0', ''), true);
  assert.equal(isNewerRelease(release('v1.4.0'), '1.4.0', ''), false, 'equal versions are not newer');
  assert.equal(isNewerRelease(release('v1.3.0'), '1.4.0', ''), false, 'older versions are not newer');
  // The pre-release suffix is ignored for the base comparison, so an equal base is still not newer.
  assert.equal(isNewerRelease(release('v1.4.0-beta.1'), '1.4.0', ''), false);
  assert.equal(isNewerRelease(release('v1.5.0-beta.1'), '1.4.0', ''), true);
});

test('a draft, a prerelease, a skipped tag or an unparseable version never counts, silently', () => {
  assert.equal(isNewerRelease(release('v2.0.0', { draft: true }), '1.4.0', ''), false);
  assert.equal(isNewerRelease(release('v2.0.0', { prerelease: true }), '1.4.0', ''), false);
  assert.equal(isNewerRelease(release('v2.0.0'), '1.4.0', 'v2.0.0'), false, 'the skipped tag is suppressed');
  assert.equal(isNewerRelease(release('v2.0.0'), '1.4.0', 'v1.9.0'), true, 'a different skipped tag still counts');
  assert.equal(isNewerRelease(release('latest'), '1.4.0', ''), false, 'a tag that is not a version never counts');
  assert.equal(isNewerRelease(null, '1.4.0', ''), false);
});
