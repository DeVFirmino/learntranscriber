const { test } = require('node:test');
const assert = require('node:assert/strict');
const { releasePageUrl } = require('../src/main/domain/updates/release-page.cjs');

const SLUG = 'DeVFirmino/learntranscriber';

test('a version tag names its page in the given repository', () => {
  assert.equal(releasePageUrl(SLUG, 'v0.2.0'), 'https://github.com/DeVFirmino/learntranscriber/releases/tag/v0.2.0');
  assert.equal(releasePageUrl(SLUG, '1.4'), 'https://github.com/DeVFirmino/learntranscriber/releases/tag/1.4');
});

test('a pre-release or build suffix stays in the tag, encoded', () => {
  assert.equal(
    releasePageUrl(SLUG, 'v1.0.0-rc.1+build.5'),
    'https://github.com/DeVFirmino/learntranscriber/releases/tag/v1.0.0-rc.1%2Bbuild.5',
  );
});

test('anything that is not a version tag has no page', () => {
  for (const tag of [
    '',
    'latest',
    'v',
    'v1.0.0/../../elsewhere',
    'v1.0.0?next=https://example.test',
    'v1.0.0#top',
    'v1.0.0 x',
    'javascript:alert(1)',
    'https://example.test/v1.0.0',
    `v1.0.0-${'a'.repeat(64)}`,
    null,
    undefined,
    1,
  ])
    assert.equal(releasePageUrl(SLUG, tag), null, String(tag));
});
