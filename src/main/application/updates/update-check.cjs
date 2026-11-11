const { isNewerRelease, parseVersion } = require('../../domain/updates/release-version.cjs');

const THROTTLE_MS = 24 * 60 * 60 * 1000;
const SNOOZE_MS = 24 * 60 * 60 * 1000;

// Checks the GitHub release once a day at most, remembering the attempt and its result so a private or
// rate-limited repository never gets asked again sooner. Later and Skip are saved choices on top of that cached
// result; nothing here keeps state of its own beyond what `settings` already persists.
function createUpdateCheck({ fetchRelease, settings, now, currentVersion }) {
  function cachedRelease() {
    const raw = settings.read().updatesLastRelease;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function state() {
    const saved = settings.read();
    const release = cachedRelease();
    const snoozedUntil = saved.updatesSnoozedUntil ? Date.parse(saved.updatesSnoozedUntil) : 0;
    if (!release || now() < snoozedUntil || !isNewerRelease(release, currentVersion, saved.updatesSkippedTag))
      return { available: false };
    return {
      available: true,
      version: parseVersion(release.tagName).join('.'),
      tagName: release.tagName,
      url: release.htmlUrl,
    };
  }

  async function check() {
    const last = settings.read().updatesLastCheckAt;
    const elapsed = last ? now() - Date.parse(last) : Infinity;
    if (elapsed >= THROTTLE_MS) {
      settings.update({ updatesLastCheckAt: new Date(now()).toISOString() });
      try {
        const release = await fetchRelease();
        settings.update({ updatesLastRelease: JSON.stringify(release) });
      } catch {
        // Silent: no network, a rate limit, a private repo's 404, or a body that is not valid JSON. The
        // previously cached release (if any) is kept, so a transient failure never hides a real update.
      }
    }
    return state();
  }

  return {
    check,
    state,
    snooze() {
      settings.update({ updatesSnoozedUntil: new Date(now() + SNOOZE_MS).toISOString() });
      return state();
    },
    skip(tag) {
      settings.update({ updatesSkippedTag: tag });
      return state();
    },
  };
}
module.exports = { createUpdateCheck };
