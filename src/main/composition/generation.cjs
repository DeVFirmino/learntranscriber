const { createGeneration } = require('../application/sessions/generate.cjs');
const { throttleFailures } = require('../application/runtime/failure-throttle.cjs');
const { persistGeneratedOutput } = require('../application/sessions/generated-output.cjs');
const { prepareSessionContext } = require('../application/sessions/context-preparation.cjs');
const { createInsightRounds } = require('../application/sessions/insight-request.cjs');
const { summaryRewriteMessages, cleanSummaryRewrite } = require('../domain/sessions/summary-rewrite.cjs');
const { requestImages } = require('../domain/sessions/images.cjs');

// Builds the answer generation for every mode: session context, the Notch
// presentation of answers, and the events each window receives while an answer streams.
function composeGeneration({
  repositories,
  active,
  requests,
  localModels,
  notch,
  compactor,
  providers,
  realtimePrompts,
  fanOut,
  changed,
}) {
  const { sessions, assistants, entries, settings } = repositories;
  const insightRounds = createInsightRounds();
  return createGeneration({
    sessions: {
      get: (id) => sessions.get(id),
      updateModel: (id, metadata) => sessions.updateModel(id, metadata),
      assistantFor: (id) => assistants.forSession(id),
      addUserEntry: (id, question, generation) => entries.add(id, 'user', question, '', null, generation),
      persistOutput: (session, mode, answer, requestId) =>
        persistGeneratedOutput({ sessions, entries }, session, mode, answer, requestId),
    },
    settings: () => settings.read(),
    active,
    requests,
    acquireLocal: (current, signal) => localModels.acquireReady('llm', current, signal),
    notch: {
      canStartInsight: (current, sessionId) => notch.state.canStart(current, sessionId, active.id()),
      presentAnswer: (answer) =>
        notch.state.offer({ ...answer, activeId: active.id(), notchOpen: notch.window.open() }, () => notch.expand()),
    },
    compactor,
    providers,
    prepareContext: (options) =>
      prepareSessionContext({
        repositories: {
          sessions,
          assistants,
          compactions: repositories.compactions,
          transcriptMemory: repositories.transcriptMemory,
        },
        compactor,
        providers,
        realtimePrompts,
        insightRounds,
        ...options,
      }),
    summaryRewrite: { messages: summaryRewriteMessages, clean: cleanSummaryRewrite },
    requestImages,
    insightRounds,
    events: {
      ownerDelta: (sender, payload) => fanOut.toSender(sender, 'ai:delta', payload),
      overlayDelta: fanOut.overlayDelta,
      answer: fanOut.answer,
      finished: fanOut.finished,
      automaticFailed: throttleFailures((message) => fanOut.broadcast('integration:error', message), {
        now: Date.now,
      }),
    },
    changed,
    timers: { setTimeout, clearTimeout },
  });
}
module.exports = { composeGeneration };
