// Browsing past sessions never pages the active one unless asked, and each successful edit publishes once.
function createSessionHistory({ sessions, activeSessionId, changed }) {
  function edited(session) {
    changed();
    return session;
  }
  return {
    list: (query) => sessions.list(query),
    page: (options) =>
      sessions.page({ ...options, excludeId: options?.excludeActive === false ? '' : activeSessionId() || '' }),
    get: (id) => sessions.get(id),
    rename: (id, title) => edited(sessions.rename(id, title)),
    updateSummary: (id, summary, expectedSummary) => edited(sessions.updateSummary(id, summary, expectedSummary)),
  };
}
module.exports = { createSessionHistory };
