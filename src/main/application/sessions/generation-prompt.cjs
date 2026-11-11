const policy = require('../../domain/sessions/generation.cjs');

// The messages for one generation. A local model that answered is recorded on the session, and a missing model or key
// fails before a chat question is stored, so a retried question is not stored once per attempt.
function createGenerationPrompt({ sessions, active, prepareContext, summaryRewrite, providers }) {
  return async function preparePrompt({ id, mode, session: s, question, images, input, route, lease, signal }) {
    if (lease && active.id() === s.id && policy.recordsLocalModel(mode))
      sessions.updateModel(s.id, { provider: 'local', model: lease.model, analysisModelSource: 'local' });
    let prepared;
    if (mode === 'summaryRewrite') {
      prepared = summaryRewrite.messages(s, input.draft, input.instructions);
      await providers.checkContext(route, prepared, signal);
    } else
      prepared = await prepareContext({
        id: s.id,
        mode,
        question,
        settings: route,
        signal,
        reviewedContext: input.context,
        liveTranscript: input.liveTranscript,
        trigger: input.trigger,
        image: images,
      });
    await providers.ready?.(route);
    signal.throwIfAborted();
    if (mode === 'chat') sessions.addUserEntry(s.id, question, { mode, requestId: id });
    return { prepared };
  };
}
module.exports = { createGenerationPrompt };
