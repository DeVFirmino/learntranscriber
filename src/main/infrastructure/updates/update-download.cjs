const fs = require('node:fs/promises');
const path = require('node:path');
const { hashedCopy } = require('../local/hashed-copy.cjs');
const {
  MAX_UPDATE_BYTES,
  MAX_CHECKSUM_BYTES,
  DMG_NAME,
  checksumFor,
} = require('../../domain/updates/update-asset.cjs');

const { isConnectionFailure } = require('../../domain/shared/connection-failure.cjs');

const REDIRECTS = [301, 302, 303, 307, 308];
const FAILED = 'The update download failed. Try again, or download it from the release page.';
const UNREACHABLE = 'Could not reach GitHub to download the update. Check your internet connection and try again.';
const TIMED_OUT = 'The update download took too long. Try again.';

// GitHub serves release assets through a redirect to its storage host; any hop must stay on HTTPS without credentials.
async function follow(fetch, url, signal) {
  let current = new URL(url);
  for (let hop = 0; hop < 6; hop++) {
    const response = await fetch(current, { redirect: 'manual', signal });
    if (!REDIRECTS.includes(response.status)) {
      if (!response.ok) throw new Error(FAILED);
      return response;
    }
    await response.body?.cancel();
    const next = new URL(response.headers.get('location') || '', current);
    if (next.protocol !== 'https:' || next.username || next.password)
      throw new Error('The update download redirected to an unsupported address.');
    current = next;
  }
  throw new Error('The update download redirected too many times.');
}

async function publishedChecksum(fetch, url, signal) {
  const response = await follow(fetch, url, signal);
  const text = await response.text();
  const digest = text.length <= MAX_CHECKSUM_BYTES ? checksumFor(text, DMG_NAME) : null;
  if (!digest) throw new Error('The release has no checksum for its DMG.');
  return digest;
}

/**
 * Downloads a release DMG into `directory` as `fileName` and keeps it only when its SHA-256 matches the checksum the
 * release publishes. The file is written under a `.part` name and renamed once it matches, so a failed or tampered
 * download never sits next to real ones. `onProgress` gets a fraction between 0 and 1, or null without a known size.
 */
async function downloadUpdate(options) {
  try {
    return await download(options);
  } catch (error) {
    if (error?.name === 'TimeoutError') throw new Error(TIMED_OUT);
    if (isConnectionFailure(error)) throw new Error(UNREACHABLE);
    throw error;
  }
}

async function download({ fetch, urls, directory, fileName, signal, onProgress = () => {} }) {
  const expected = await publishedChecksum(fetch, urls.checksum, signal);
  const response = await follow(fetch, urls.dmg, signal);
  const size = Number(response.headers.get('content-length')) || 0;
  if (size > MAX_UPDATE_BYTES) {
    await response.body?.cancel();
    throw new Error('The update is larger than any LearnTranscriber release.');
  }
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, fileName);
  const partial = `${target}.part`;
  const output = await fs.open(partial, 'w', 0o600);
  try {
    const { sha256 } = await hashedCopy(output, response.body, {
      signal,
      maxBytes: MAX_UPDATE_BYTES,
      limitMessage: 'The update is larger than any LearnTranscriber release.',
      onBytes: (bytes) => onProgress(size ? Math.min(bytes / size, 1) : null),
    });
    await output.close();
    if (sha256 !== expected)
      throw new Error('The downloaded update does not match its published checksum, so it was deleted.');
    await fs.rename(partial, target);
    return target;
  } catch (error) {
    await output.close().catch(() => {});
    await fs.rm(partial, { force: true });
    throw error;
  }
}

module.exports = { downloadUpdate };
