const { validateSegment } = require('../../domain/audio/segment.cjs');

// Transcribing a recorded segment of the live session. Ending the session waits for accepted segments.
// A segment id makes a retry idempotent: a retry while the first attempt still runs joins it, and a retry
// after it returns the saved text. Only the attempt that inserts the line publishes the change.
function createSegmentTranscription({ active, jobs, transcripts, transcribe, settings, timeout, changed }) {
  const inFlight = new Map();
  async function once(input, segmentId) {
    const existing = segmentId ? transcripts.segment(input.sessionId, segmentId) : null;
    if (existing) return existing.content;
    const content = await transcribe(input, settings(), timeout());
    if (!content) return content;
    const saved = segmentId ? transcripts.segment(input.sessionId, segmentId) : null;
    if (saved) return saved.content;
    transcripts.add(input.sessionId, content, input.speaker, segmentId);
    changed();
    return content;
  }
  return {
    transcribe(input) {
      if (active.id() !== input?.sessionId) throw new Error('Start or resume this session before recording.');
      validateSegment(input);
      const segmentId = input.segmentId === undefined ? null : input.segmentId;
      if (!segmentId) return jobs.run(input.sessionId, () => once(input, null));
      const key = `${input.sessionId}\u0000${segmentId}`;
      if (inFlight.has(key)) return inFlight.get(key);
      const job = jobs.run(input.sessionId, () => once(input, segmentId));
      inFlight.set(key, job);
      const settle = () => {
        if (inFlight.get(key) === job) inFlight.delete(key);
      };
      job.then(settle, settle);
      return job;
    },
  };
}
module.exports = { createSegmentTranscription };
