// A release tag as dotted numbers: a leading v/V is ignored, and so is everything from the first '-' or '+', the
// pre-release or build suffix. Anything else, including a tag with no digits, is not a version.
function parseVersion(tag) {
  if (typeof tag !== 'string') return null;
  const base = tag.replace(/^[vV]/, '').split(/[-+]/, 1)[0];
  const parts = base.split('.');
  if (!base || parts.some((part) => !/^\d+$/.test(part))) return null;
  return parts.map(Number);
}

// Compares two parsed versions component by component, treating a missing trailing component as zero.
function compareVersions(a, b) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    const left = a[index] || 0,
      right = b[index] || 0;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

// Whether a release is worth telling the user about: not a draft or a prerelease, not the tag they chose to skip,
// and a newer base version than the one running. A tag or a current version that does not parse never counts.
function isNewerRelease(release, currentVersion, skippedTag) {
  if (!release || release.draft || release.prerelease) return false;
  if (skippedTag && release.tagName === skippedTag) return false;
  const latest = parseVersion(release.tagName);
  const current = parseVersion(currentVersion);
  if (!latest || !current) return false;
  return compareVersions(latest, current) > 0;
}

module.exports = { parseVersion, compareVersions, isNewerRelease };
