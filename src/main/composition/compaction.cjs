const { randomUUID } = require('node:crypto');
const { createCompactor } = require('../application/compaction/compact.cjs');
const { createTranscriptCompactor } = require('../application/compaction/transcript.cjs');

// Compaction keeps long sessions within the model's context: the chat history on request, and the transcript of the
// live session while it listens.
function composeCompaction({ repositories, active, listening, route, providers, changed, report }) {
  return {
    compactor: createCompactor({
      sessions: repositories.sessions,
      compactions: repositories.compactions,
      providers,
      now: () => new Date(),
      newId: randomUUID,
    }),
    transcriptCompactor: createTranscriptCompactor({
      repository: repositories.transcriptMemory,
      active,
      listening,
      settings: () => repositories.settings.read(),
      route,
      providers,
      changed,
      report,
      timers: { setTimeout, clearTimeout },
      now: () => new Date(),
      newId: randomUUID,
    }),
  };
}
module.exports = { composeCompaction };
