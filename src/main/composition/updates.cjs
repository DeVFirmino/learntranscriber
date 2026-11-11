const { githubReleases } = require('../infrastructure/integrations/github-releases.cjs');
const { createUpdateCheck } = require('../application/updates/update-check.cjs');
const { registerUpdates } = require('../interface/ipc/updates.cjs');

// The repository builds are published to. A composition-level constant: domain and application never see it, only
// the fetch call this module closes over.
const REPO_SLUG = 'DeVFirmino/learntranscriber';
const FIRST_CHECK_DELAY_MS = 15000;
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Checks the repository's GitHub releases for a newer build: once about fifteen seconds after start, then every
// six hours, though the use case itself still only lets an actual request through once a day. Registers its own
// IPC channels and pushes the result whenever a check, Later or Skip changes it.
function composeUpdates({
  handle,
  settings,
  version,
  openExternal,
  broadcast,
  schedule,
  timers = { setTimeout, clearTimeout, setInterval, clearInterval },
  now = Date.now,
}) {
  const releases = githubReleases({ fetch });
  const updateCheck = createUpdateCheck({
    fetchRelease: () => releases.latestRelease(REPO_SLUG, { userAgent: `LearnTranscriber/${version}` }),
    settings,
    now,
    currentVersion: version,
  });
  function publish(state) {
    broadcast('updates:changed', state);
    return state;
  }
  registerUpdates(handle, {
    state: () => updateCheck.state(),
    open() {
      const current = updateCheck.state();
      return current.available ? openExternal(current.url).then(() => true) : Promise.resolve(false);
    },
    later: () => publish(updateCheck.snooze()),
    skip: (tag) => publish(updateCheck.skip(tag)),
  });
  let first = null,
    interval = null;
  if (schedule) {
    first = timers.setTimeout(() => void updateCheck.check().then(publish), FIRST_CHECK_DELAY_MS);
    first.unref?.();
    interval = timers.setInterval(() => void updateCheck.check().then(publish), RECHECK_INTERVAL_MS);
    interval.unref?.();
  }
  return {
    close() {
      timers.clearTimeout(first);
      timers.clearInterval(interval);
    },
  };
}
module.exports = { composeUpdates, REPO_SLUG };
