const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUpdateCheck } = require('../src/main/application/updates/update-check.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;

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

function fakeClock(start) {
  let value = start;
  return { now: () => value, advance: (ms) => (value += ms) };
}

function harness({
  settings = fakeSettings(),
  clock = fakeClock(1000000),
  fetchRelease,
  currentVersion = '1.0.0',
} = {}) {
  let calls = 0;
  const check = createUpdateCheck({
    fetchRelease: async () => {
      calls++;
      return fetchRelease();
    },
    settings,
    now: clock.now,
    currentVersion,
  });
  return { check, settings, clock, calls: () => calls };
}

test('a first check fetches the release and reports it as available when newer', async () => {
  const h = harness({
    fetchRelease: async () => ({ tagName: 'v2.0.0', draft: false, prerelease: false }),
  });
  const state = await h.check.check();
  assert.deepEqual(state, { available: true, version: '2.0.0', tagName: 'v2.0.0' });
  assert.equal(h.calls(), 1);
  assert.equal(h.settings.read().updatesLastCheckAt !== '', true);
});

test('a second check inside the 24-hour window never sends another request', async () => {
  const h = harness({
    fetchRelease: async () => ({ tagName: 'v2.0.0', draft: false, prerelease: false }),
  });
  await h.check.check();
  h.clock.advance(DAY_MS - 1000);
  const state = await h.check.check();
  assert.equal(h.calls(), 1, 'still only the first request');
  assert.equal(state.available, true, 'the cached release is still reported');
});

test('a check at or after 24 hours sends exactly one more request', async () => {
  const h = harness({
    fetchRelease: async () => ({ tagName: 'v2.0.0', draft: false, prerelease: false }),
  });
  await h.check.check();
  h.clock.advance(DAY_MS);
  await h.check.check();
  assert.equal(h.calls(), 2);
});

test('network, rate-limit, missing-repo and invalid-JSON failures are all silent and keep the last known release', async () => {
  for (const failure of [
    () => {
      throw new Error('fetch failed');
    },
    () => {
      throw new Error('GitHub releases returned HTTP 403.');
    },
    () => {
      throw new Error('GitHub releases returned HTTP 404.');
    },
    () => {
      throw new SyntaxError('Unexpected token in JSON');
    },
  ]) {
    const settings = fakeSettings({
      updatesLastRelease: JSON.stringify({ tagName: 'v2.0.0', draft: false, prerelease: false }),
    });
    const h = harness({ settings, fetchRelease: failure });
    const state = await h.check.check();
    assert.equal(state.available, true, 'the previously cached release survives a failed refresh');
    assert.equal(
      h.settings.read().updatesLastCheckAt !== '',
      true,
      'the attempt is still recorded, to hold the throttle',
    );
  }
});

test('a failed first check, with nothing cached yet, silently reports nothing available', async () => {
  const h = harness({
    fetchRelease: () => {
      throw new Error('404');
    },
  });
  assert.deepEqual(await h.check.check(), { available: false });
});

test('a tag that is not a version is cached but never reported as available', async () => {
  const h = harness({
    fetchRelease: async () => ({ tagName: 'latest', draft: false, prerelease: false }),
  });
  assert.deepEqual(await h.check.check(), { available: false });
});

test('Later hides the current release for at least 24 hours, then the state can show it again', async () => {
  const h = harness({
    fetchRelease: async () => ({ tagName: 'v2.0.0', draft: false, prerelease: false }),
  });
  await h.check.check();
  const afterLater = h.check.snooze();
  assert.equal(afterLater.available, false);
  assert.equal(h.check.state().available, false, 'still hidden right after Later');
  h.clock.advance(DAY_MS - 1000);
  assert.equal(h.check.state().available, false, 'still hidden before 24 hours pass');
  h.clock.advance(1000);
  assert.equal(h.check.state().available, true, 'visible again once the snooze has elapsed');
});

test('Skip never shows that exact tag again, but a later, different tag still does', async () => {
  const h = harness({
    fetchRelease: async () => ({ tagName: 'v2.0.0', draft: false, prerelease: false }),
  });
  await h.check.check();
  const afterSkip = h.check.skip('v2.0.0');
  assert.equal(afterSkip.available, false);
  assert.equal(h.check.state().available, false);
  h.settings.update({
    updatesLastRelease: JSON.stringify({ tagName: 'v2.1.0', draft: false, prerelease: false }),
  });
  assert.equal(h.check.state().available, true, 'a newer tag than the skipped one is still reported');
});

test('an older or equal cached release, or one draft/prerelease, is never reported as available', async () => {
  const equal = harness({
    currentVersion: '2.0.0',
    fetchRelease: async () => ({ tagName: 'v2.0.0', draft: false, prerelease: false }),
  });
  assert.equal((await equal.check.check()).available, false);
  const older = harness({
    currentVersion: '3.0.0',
    fetchRelease: async () => ({ tagName: 'v2.0.0', draft: false, prerelease: false }),
  });
  assert.equal((await older.check.check()).available, false);
  const draft = harness({
    fetchRelease: async () => ({ tagName: 'v9.0.0', draft: true, prerelease: false }),
  });
  assert.equal((await draft.check.check()).available, false);
});
