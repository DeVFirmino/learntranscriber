// The history port: paging and search stay in SQL, and the summary keeps its compare-and-set.
function sessionHistoryRepository({ sessions, sessionSearch }) {
  return {
    list: (query) => sessionSearch.list(query),
    page: (options) => sessionSearch.page(options),
    get: (id) => sessions.get(id),
    rename: (id, title) => sessions.update(id, { title }),
    updateSummary: (id, summary, expectedSummary) => sessions.updateSummary(id, summary, expectedSummary),
  };
}
module.exports = { sessionHistoryRepository };
