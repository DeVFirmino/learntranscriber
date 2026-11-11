const { forFeature } = require('../../domain/providers/generation-presets.cjs');
const { outputLanguage } = require('../../domain/sessions/compaction.cjs');
const {
  isDefaultTitle,
  hasConversation,
  titleMessages,
  cleanTitle,
} = require('../../domain/sessions/session-title.cjs');

// Names a session from its conversation once it ends, and once names the saved sessions that still carry the default
// title, one at a time. A title the user typed is never replaced, even when it arrives while the model answers.
function createSessionTitles({
  sessions,
  saved,
  activeId,
  settings,
  providers,
  route,
  requests,
  recordBackfill,
  changed,
  log,
}) {
  async function title(sessionId, signal) {
    signal.throwIfAborted();
    const requestId = `session-title:${sessionId}`;
    if (requests.has(requestId) || activeId() === sessionId) return null;
    const session = sessions.get(sessionId);
    if (!session || !isDefaultTitle(session.title) || !hasConversation(session)) return null;
    const originalTitle = session.title;
    return requests.run(
      { id: requestId, owner: null, sessionId, mode: 'sessionTitle', timeoutMs: 120000 },
      async (requestSignal) => {
        const combined = AbortSignal.any([signal, requestSignal]);
        const current = settings();
        const messages = titleMessages({ session, language: outputLanguage(current) });
        const raw = await route.run(
          current,
          (chosen) => providers.stream(forFeature(chosen, 'tldr'), messages, () => {}, combined),
          { signal: combined },
        );
        combined.throwIfAborted();
        if (activeId() === sessionId) return null;
        const named = cleanTitle(raw);
        if (!named || sessions.get(sessionId).title !== originalTitle) return null;
        sessions.rename(sessionId, named);
        changed();
        return named;
      },
    );
  }

  return {
    title,
    // A pass that named nothing while sessions were waiting is retried on the next launch, e.g. before a model is set.
    async backfill(signal) {
      signal.throwIfAborted();
      if (settings().sessionTitlesBackfilled) return;
      const pending = [];
      const limit = 200;
      for (let offset = 0; ; offset += limit) {
        signal.throwIfAborted();
        const page = saved({ limit, offset });
        pending.push(
          ...page
            .filter((session) => isDefaultTitle(session.title) && session.id !== activeId())
            .map((session) => session.id),
        );
        if (page.length < limit) break;
      }
      let named = 0;
      for (const id of pending) {
        signal.throwIfAborted();
        try {
          if (await title(id, signal)) named++;
        } catch (error) {
          log(`Session title for ${id} failed: ${error.message}`);
        }
      }
      signal.throwIfAborted();
      if (!pending.length || named) recordBackfill();
    },
  };
}

module.exports = { createSessionTitles };
