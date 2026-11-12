// A downloaded update is kept only when it matches the checksum its release publishes; anything else leaves no file.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { downloadUpdate } = require('../src/main/infrastructure/updates/update-download.cjs');

const DMG = Buffer.from('a disk image');
const DIGEST = createHash('sha256').update(DMG).digest('hex');
const urls = {
  dmg: 'https://github.com/o/r/releases/download/v1/LearnTranscriber-arm64.dmg',
  checksum: 'https://github.com/o/r/releases/download/v1/LearnTranscriber-arm64.dmg.sha256',
};
const STORAGE = 'https://release-assets.githubusercontent.com/asset';

// GitHub answers each asset with a redirect to its storage host, which serves the bytes.
function github({ checksum = `${DIGEST}  LearnTranscriber-arm64.dmg\n`, dmg = DMG, redirect = STORAGE } = {}) {
  const requested = [];
  const fetch = async (url) => {
    const href = String(url);
    requested.push(href);
    if (href === urls.dmg) return new Response(null, { status: 302, headers: { location: redirect } });
    if (href === urls.checksum) return new Response(checksum);
    if (href === STORAGE) return new Response(dmg, { headers: { 'content-length': String(dmg.length) } });
    return new Response('missing', { status: 404 });
  };
  return { fetch, requested };
}

const folder = () => fs.mkdtempSync(path.join(os.tmpdir(), 'update-download-'));
const run = (fetch, directory, onProgress) =>
  downloadUpdate({
    fetch,
    urls,
    directory,
    fileName: 'LearnTranscriber-1.0.0-arm64.dmg',
    signal: new AbortController().signal,
    onProgress,
  });

test('a matching download is saved under its versioned name and reports progress up to the whole file', async () => {
  const directory = folder();
  const progress = [];
  const saved = await run(github().fetch, directory, (value) => progress.push(value));
  assert.equal(saved, path.join(directory, 'LearnTranscriber-1.0.0-arm64.dmg'));
  assert.deepEqual(fs.readFileSync(saved), DMG);
  assert.deepEqual(fs.readdirSync(directory), ['LearnTranscriber-1.0.0-arm64.dmg']);
  assert.equal(progress.at(-1), 1);
});

test('a download that does not match the published checksum is deleted', async () => {
  const directory = folder();
  const { fetch } = github({ dmg: Buffer.from('something else') });
  await assert.rejects(run(fetch, directory), /does not match its published checksum/);
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('without a checksum for the DMG nothing is downloaded', async () => {
  const directory = folder();
  const { fetch, requested } = github({ checksum: `${DIGEST}  another.dmg` });
  await assert.rejects(run(fetch, directory), /no checksum/);
  assert.deepEqual(requested, [urls.checksum]);
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('a redirect away from HTTPS is refused', async () => {
  const directory = folder();
  const { fetch } = github({ redirect: 'http://example.com/asset' });
  await assert.rejects(run(fetch, directory), /unsupported address/);
  assert.deepEqual(fs.readdirSync(directory), []);
});
