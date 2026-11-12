const { test } = require('node:test');
const assert = require('node:assert/strict');
const { composeUpdates, REPO_SLUG } = require('../src/main/composition/updates.cjs');

function fakeSettings(initial = {}) {
  let saved = {
    updatesLastCheckAt: '',
    updatesLastRelease: '',
    updatesSnoozedUntil: '',
    updatesSkippedTag: '',
    ...initial,
  };
  return {
    read: () => ({ ...saved }),
    update: (patch) => {
      saved = { ...saved, ...patch };
      return { ...saved };
    },
  };
}

test('the repository slug is the owner and name the checks are published under', () => {
  assert.equal(REPO_SLUG, 'DeVFirmino/learntranscriber');
});

test('scheduling sets the fifteen-second first check and the six-hour recheck, and close clears both', () => {
  const scheduled = [];
  const cleared = [];
  const timers = {
    setTimeout: (work, delay) => {
      scheduled.push(['timeout', delay]);
      return { id: 'first', unref() {} };
    },
    clearTimeout: (handle) => cleared.push(['timeout', handle]),
    setInterval: (work, delay) => {
      scheduled.push(['interval', delay]);
      return { id: 'interval', unref() {} };
    },
    clearInterval: (handle) => cleared.push(['interval', handle]),
  };
  const updates = composeUpdates({
    handle: () => {},
    settings: fakeSettings(),
    version: '1.0.0',
    openExternal: async () => {},
    broadcast: () => {},
    schedule: true,
    timers,
    now: () => 0,
  });
  assert.deepEqual(scheduled, [
    ['timeout', 15000],
    ['interval', 6 * 60 * 60 * 1000],
  ]);
  updates.close();
  assert.deepEqual(
    cleared.map(([kind, handle]) => [kind, handle.id]),
    [
      ['timeout', 'first'],
      ['interval', 'interval'],
    ],
  );
});

test('schedule: false registers the IPC channels but starts no timer', () => {
  const channels = [];
  const timers = {
    setTimeout: () => assert.fail('must not schedule while disabled'),
    clearTimeout: () => {},
    setInterval: () => assert.fail('must not schedule while disabled'),
    clearInterval: () => {},
  };
  const updates = composeUpdates({
    handle: (channel) => channels.push(channel),
    settings: fakeSettings(),
    version: '1.0.0',
    openExternal: async () => {},
    broadcast: () => {},
    schedule: false,
    timers,
    now: () => 0,
  });
  assert.deepEqual(channels.sort(), [
    'updates:download',
    'updates:install',
    'updates:later',
    'updates:open',
    'updates:skip',
    'updates:state',
  ]);
  updates.close();
});

test('open resolves false and never calls the browser opener when nothing is available', async () => {
  const opened = [];
  let openHandler;
  composeUpdates({
    handle: (channel, fn) => {
      if (channel === 'updates:open') openHandler = fn;
    },
    settings: fakeSettings(),
    version: '1.0.0',
    openExternal: async (url) => opened.push(url),
    broadcast: () => {},
    schedule: false,
    now: () => 0,
  });
  assert.equal(await openHandler(), false);
  assert.deepEqual(opened, []);
});

function openWithCachedRelease(release) {
  const opened = [];
  let openHandler;
  composeUpdates({
    handle: (channel, fn) => {
      if (channel === 'updates:open') openHandler = fn;
    },
    settings: fakeSettings({ updatesLastRelease: JSON.stringify(release) }),
    version: '1.0.0',
    openExternal: async (url) => opened.push(url),
    broadcast: () => {},
    schedule: false,
    now: () => 0,
  });
  return { opened, open: () => openHandler() };
}

test('open shows the release page of this repository for the tag on offer', async () => {
  const { opened, open } = openWithCachedRelease({ tagName: 'v9.9.9', draft: false, prerelease: false });
  assert.equal(await open(), true);
  assert.deepEqual(opened, ['https://github.com/DeVFirmino/learntranscriber/releases/tag/v9.9.9']);
});

test('a link saved with the cached release never reaches the browser opener', async () => {
  for (const htmlUrl of ['review-canary:blocked', 'file:///etc/passwd', 'https://example.test/release']) {
    const { opened, open } = openWithCachedRelease({ tagName: 'v9.9.9', htmlUrl, draft: false, prerelease: false });
    assert.equal(await open(), true);
    assert.deepEqual(opened, ['https://github.com/DeVFirmino/learntranscriber/releases/tag/v9.9.9']);
  }
});

test('a newer tag that cannot name a release page opens nothing', async () => {
  const { opened, open } = openWithCachedRelease({
    tagName: 'v9.9.9-x/../../elsewhere',
    draft: false,
    prerelease: false,
  });
  assert.equal(await open(), false);
  assert.deepEqual(opened, []);
});

test('download saves the checked release DMG once it matches its checksum, and install opens that file', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { createHash } = require('node:crypto');
  const dmg = Buffer.from('release image');
  const digest = createHash('sha256').update(dmg).digest('hex');
  const base = `https://github.com/${REPO_SLUG}/releases/download/v2.0.0/LearnTranscriber-arm64.dmg`;
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    if (String(url) === `${base}.sha256`) return new Response(`${digest}  LearnTranscriber-arm64.dmg`);
    if (String(url) === base) return new Response(dmg, { headers: { 'content-length': String(dmg.length) } });
    return new Response('', { status: 404 });
  };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'update-composition-'));
  const handlers = {};
  const opened = [];
  const broadcasts = [];
  composeUpdates({
    handle: (channel, handler) => (handlers[channel] = handler),
    settings: fakeSettings({ updatesLastRelease: JSON.stringify({ tagName: 'v2.0.0' }) }),
    version: '1.0.0',
    openExternal: async () => {},
    openPath: async (file) => {
      opened.push(file);
      return '';
    },
    downloads: () => directory,
    fetchImpl,
    broadcast: (channel, value) => broadcasts.push(value),
    schedule: false,
    now: () => 0,
  });
  assert.equal((await handlers['updates:state']()).download.phase, 'idle');
  assert.equal(await handlers['updates:install'](), false);
  await handlers['updates:download'](null, 'v9.9.9');
  for (let i = 0; i < 50 && broadcasts.at(-1)?.download?.phase !== 'ready'; i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(broadcasts.at(-1).download.phase, 'ready');
  assert.ok(requested.every((url) => url.includes('/v2.0.0/')));
  assert.equal(await handlers['updates:install'](), true);
  assert.deepEqual(opened, [path.join(directory, 'LearnTranscriber-2.0.0-arm64.dmg')]);
});
