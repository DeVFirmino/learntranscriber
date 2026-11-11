// Counts across the saved history, and clearing it. Settings, credentials and assistants stay.
const CLEARED_TABLES = ['entries', 'session_compactions', 'context_items', 'sessions'];

function historyMaintenance({ db, transaction }) {
  function stats() {
    const count = (sql) => db.prepare(sql).get().count;
    return {
      totalSessions: count('SELECT COUNT(*) AS count FROM sessions'),
      totalMessages: count("SELECT COUNT(*) AS count FROM entries WHERE kind IN ('user','assistant')"),
      totalTranscriptions: count("SELECT COUNT(*) AS count FROM entries WHERE kind='transcript'"),
      activeSessions: count('SELECT COUNT(*) AS count FROM sessions WHERE ended_at IS NULL'),
    };
  }
  return {
    stats,
    clear: () =>
      transaction(db, () => {
        const { totalSessions: sessions, totalMessages: messages, totalTranscriptions: transcriptions } = stats();
        for (const table of CLEARED_TABLES) db.exec(`DELETE FROM ${table}`);
        return { sessions, messages, transcriptions };
      }),
  };
}
module.exports = { historyMaintenance };
