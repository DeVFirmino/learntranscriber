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
  assert.deepEqual(channels.sort(), ['updates:later', 'updates:open', 'updates:skip', 'updates:state']);
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

test('open calls the browser opener with the known release URL when one is available', async () => {
  const opened = [];
  let openHandler;
  const settings = fakeSettings({
    updatesLastRelease: JSON.stringify({
      tagName: 'v9.9.9',
      htmlUrl: 'https://example.test/release',
      draft: false,
      prerelease: false,
    }),
  });
  composeUpdates({
    handle: (channel, fn) => {
      if (channel === 'updates:open') openHandler = fn;
    },
    settings,
    version: '1.0.0',
    openExternal: async (url) => opened.push(url),
    broadcast: () => {},
    schedule: false,
    now: () => 0,
  });
  assert.equal(await openHandler(), true);
  assert.deepEqual(opened, ['https://example.test/release']);
});
