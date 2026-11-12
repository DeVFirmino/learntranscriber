// A release tag as this project writes them: dotted numbers after an optional v, then at most one pre-release or
// build suffix in the characters semver allows. The length cap keeps the check cheap on any input.
const RELEASE_TAG = /^[vV]?\d+(?:\.\d+)*(?:[-+][0-9A-Za-z.+-]*)?$/;
const MAX_TAG_LENGTH = 64;

function isReleaseTag(tagName) {
  return typeof tagName === 'string' && tagName.length <= MAX_TAG_LENGTH && RELEASE_TAG.test(tagName);
}

// The GitHub page of one release, built from the fixed repository and a tag that passes RELEASE_TAG, so whatever the
// cached release says, Open can only reach this repository's own release page. Any other tag has no page.
function releasePageUrl(slug, tagName) {
  if (!isReleaseTag(tagName)) return null;
  return `https://github.com/${slug}/releases/tag/${encodeURIComponent(tagName)}`;
}

module.exports = { releasePageUrl, isReleaseTag };
