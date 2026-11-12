const { githubReleases } = require('../infrastructure/integrations/github-releases.cjs');
const { createUpdateCheck } = require('../application/updates/update-check.cjs');
const { releasePageUrl } = require('../domain/updates/release-page.cjs');
const { createUpdateInstall } = require('../application/updates/update-install.cjs');
const { updateAssetUrls, updateFileName } = require('../domain/updates/update-asset.cjs');
const { downloadUpdate } = require('../infrastructure/updates/update-download.cjs');
const { registerUpdates } = require('../interface/ipc/updates.cjs');

// The repository builds are published to. A composition-level constant: domain and application never see it, only
// the fetch call this module closes over.
const REPO_SLUG = 'DeVFirmino/learntranscriber';
const FIRST_CHECK_DELAY_MS = 15000;
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Checks the repository's GitHub releases for a newer build: once about fifteen seconds after start, then every
// six hours, though the use case itself still only lets an actual request through once a day. Registers its own
// IPC channels and pushes the result whenever a check, Later or Skip changes it. Download saves the release DMG to
// `downloads()` once its SHA-256 matches the release's checksum file, and Install opens that DMG.
function composeUpdates({
  handle,
  settings,
  version,
  openExternal,
  openPath = async () => '',
  downloads = () => null,
  fetchImpl = fetch,
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
  const install = createUpdateInstall({
    download(tagName, nextVersion, onProgress) {
      const urls = updateAssetUrls(REPO_SLUG, tagName);
      const directory = downloads();
      if (!urls || !directory) return Promise.reject(new Error('This update cannot be downloaded here.'));
      return downloadUpdate({
        fetch: fetchImpl,
        urls,
        directory,
        fileName: updateFileName(nextVersion),
        signal: AbortSignal.timeout(30 * 60000),
        onProgress,
      });
    },
    async openFile(file) {
      const failure = await openPath(file);
      if (failure) throw new Error('Could not open the downloaded update.');
    },
    changed: () => broadcast('updates:changed', state()),
  });
  // The release check's result, with the download of that release when one was started.
  function state(checked = updateCheck.state()) {
    return checked.available ? { ...checked, download: install.state(checked.tagName) } : checked;
  }
  function publish(checked) {
    const next = state(checked);
    broadcast('updates:changed', next);
    return next;
  }
  registerUpdates(handle, {
    state: () => state(),
    // The page comes from the repository slug and the tag, never from the cached release, which the renderer can
    // reach through settings.
    open() {
      const current = updateCheck.state();
      const page = current.available ? releasePageUrl(REPO_SLUG, current.tagName) : null;
      return page ? openExternal(page).then(() => true) : Promise.resolve(false);
    },
    // The release to download and open is always the one the check found, never one the renderer names.
    download() {
      const current = updateCheck.state();
      if (!current.available) return Promise.resolve(state(current));
      void install.start(current.tagName, current.version);
      return Promise.resolve(state(current));
    },
    install() {
      const current = updateCheck.state();
      return current.available ? install.open(current.tagName) : Promise.resolve(false);
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
