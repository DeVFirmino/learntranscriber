// Starting, resuming, ending and deleting a session. Ending cancels its requests, stops capture and
// drains transcription before the end is persisted, then clears the live session and publishes. A started or
// resumed session is announced, so its baseline screen read can run; an ended one is announced so it can be named.
function createSessionLifecycle({
  sessions,
  active,
  defaults,
  requests,
  systemAudio,
  appleSpeech,
  transcriptionJobs,
  now,
  changed,
  started = () => {},
  ended = () => {},
}) {
  return {
    // The live session exists only while the app runs, so a session an earlier run left open (the app quit or stopped
    // before it was ended) is closed at its last entry, which keeps its duration true. The live one stays open.
    closeLeftOpen() {
      return sessions.closeLeftOpen(active.id());
    },
    create(title) {
      if (active.id()) throw new Error('End the active session before creating another.');
      const { assistantId, metadata } = defaults();
      const session = sessions.create(title, assistantId, metadata);
      active.set(session.id);
      changed();
      started(session.id);
      return session;
    },
    resume(id) {
      if (active.id() && active.id() !== id) throw new Error('End the active session first.');
      const session = sessions.reopen(id);
      transcriptionJobs.open(id);
      active.set(id);
      changed();
      started(id);
      return session;
    },
    async end(id) {
      requests.cancelSession(id);
      await systemAudio.stop();
      await appleSpeech.stopSession(id);
      await transcriptionJobs.close(id);
      const session = sessions.end(id, now().toISOString());
      active.clear(id);
      changed();
      ended(id);
      return session;
    },
    delete(id) {
      if (active.id() === id) throw new Error('End the session before deleting it.');
      requests.cancelSession(id);
      sessions.delete(id);
      changed();
      return true;
    },
    deleteMany(ids) {
      if (ids.includes(active.id())) throw new Error('End the session before deleting it.');
      for (const id of ids) requests.cancelSession(id);
      sessions.deleteMany(ids);
      changed();
      return ids.length;
    },
  };
}
module.exports = { createSessionLifecycle };
