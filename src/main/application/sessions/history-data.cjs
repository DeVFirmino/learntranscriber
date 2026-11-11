// Whole-history operations: statistics, clearing (never during a live session), manual transcript lines and
// undoing the last compaction. Each change publishes once.
function createHistoryData({ history, entries, active, compactor, changed }) {
  return {
    stats: () => history.stats(),
    clear() {
      if (active.id()) throw new Error('End the active session before clearing history.');
      const result = history.clear();
      changed();
      return result;
    },
    appendTranscript({ sessionId, text, speaker }) {
      const entry = entries.add(sessionId, 'transcript', text, speaker);
      changed();
      return entry;
    },
    undoCompaction(id) {
      const result = compactor().undo(id);
      changed();
      return result;
    },
  };
}
module.exports = { createHistoryData };
