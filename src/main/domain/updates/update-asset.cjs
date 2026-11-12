const { isReleaseTag } = require('./release-page.cjs');

// Every release publishes the Apple Silicon DMG and a .sha256 file beside it, under these fixed names.
const DMG_NAME = 'LearnTranscriber-arm64.dmg';
// A DMG well past this is not one of ours; the download stops there instead of filling the disk.
const MAX_UPDATE_BYTES = 1024 * 1024 * 1024;
const MAX_CHECKSUM_BYTES = 1024;

// The DMG and checksum addresses of one release, built from the fixed repository and a tag that passes the release
// tag check, so a cached release can only point at this repository's own assets. Any other tag has none.
function updateAssetUrls(slug, tagName) {
  if (!isReleaseTag(tagName)) return null;
  const base = `https://github.com/${slug}/releases/download/${encodeURIComponent(tagName)}/`;
  return { dmg: base + DMG_NAME, checksum: `${base}${DMG_NAME}.sha256` };
}

// The SHA-256 a checksum file gives for `fileName`, in the `shasum -a 256` format: 64 hex digits, whitespace and an
// optional `*`, then the name. A line for another file, or none at all, gives null.
function checksumFor(text, fileName) {
  for (const line of String(text).split(/\r?\n/)) {
    const match = /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(line.trim());
    if (match && match[2] === fileName) return match[1].toLowerCase();
  }
  return null;
}

// Where a downloaded update is saved: the DMG name with its version, so two versions never overwrite each other.
function updateFileName(version) {
  return `LearnTranscriber-${String(version).replace(/[^0-9A-Za-z.+-]/g, '')}-arm64.dmg`;
}

module.exports = { DMG_NAME, MAX_UPDATE_BYTES, MAX_CHECKSUM_BYTES, updateAssetUrls, checksumFor, updateFileName };
