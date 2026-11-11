const { createModelRoute } = require('../application/runtime/model-route.cjs');
const { createOwnerCleanup } = require('../application/runtime/owner-cleanup.cjs');
const { createRequestRegistry } = require('../application/runtime/requests.cjs');
const { createShutdown } = require('../application/runtime/shutdown.cjs');
const { quitHandshake } = require('../infrastructure/electron/quit-handshake.cjs');

// The runtime every feature shares: the running requests, what a closing window leaves behind, the model route, and
// quitting, which flushes the recordings and drains transcription before it closes every resource. The live engines,
// local models and audio helper exist only after start, so they are read when used.
function composeRuntime({ live, localModels, systemAudio, transcriptionJobs, mainWindow }) {
  const requests = createRequestRegistry({ timers: { setTimeout, clearTimeout } });
  const ownerCleanup = createOwnerCleanup({
    requests,
    transcribers: () => [live()?.whisper, live()?.realtime, live()?.gemini, live()?.apple],
  });
  const modelRoute = createModelRoute({
    acquireLocal: (settings, signal) => localModels().acquireReady('llm', settings, signal),
  });
  const quitFlush = quitHandshake({ main: mainWindow });
  const shutdown = createShutdown({
    flushRecordings: () => quitFlush.flush(),
    drainSegments: () => transcriptionJobs.drainAll(),
    drainTranscription: () => {
      const engines = live();
      return Promise.allSettled([
        engines?.whisper.drain(),
        engines?.realtime.drain(),
        engines?.gemini.drain(),
        engines?.apple.drain(),
      ]);
    },
    abortRequests: () => requests.cancelAll(),
    pendingRequests: () => requests.pending(),
    timers: { setTimeout, clearTimeout },
    now: Date.now,
    closeResources: () => {
      const engines = live();
      return [
        localModels().close(),
        systemAudio().close(),
        engines.whisper.close(),
        engines.realtime.close(),
        engines.gemini.close(),
        engines.apple.close(),
      ];
    },
  });
  return { requests, ownerCleanup, modelRoute, quitFlush, shutdown };
}
module.exports = { composeRuntime };
