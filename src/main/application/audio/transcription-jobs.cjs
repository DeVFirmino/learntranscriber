// Tracks accepted transcription segments per session so ending a session drains them
// first and refuses new ones, instead of letting late results land after the end.
function createTranscriptionJobs() {
  const running = new Map(),
    closing = new Set();
  let sealed = false;
  return {
    async run(sessionId, work) {
      if (sealed) throw new Error('LearnTranscriber is closing.');
      if (closing.has(sessionId)) throw new Error('This session is no longer active.');
      const jobs = running.get(sessionId) || new Set(),
        job = Promise.resolve().then(work);
      jobs.add(job);
      running.set(sessionId, jobs);
      try {
        return await job;
      } finally {
        jobs.delete(job);
        if (!jobs.size) running.delete(sessionId);
      }
    },
    async close(sessionId) {
      closing.add(sessionId);
      await Promise.allSettled(running.get(sessionId) || []);
    },
    open(sessionId) {
      closing.delete(sessionId);
    },
    // Quit: refuse every new segment and wait for all accepted ones to be saved.
    async drainAll() {
      sealed = true;
      await Promise.allSettled([...running.values()].flatMap((jobs) => [...jobs]));
    },
  };
}
module.exports = { createTranscriptionJobs };
