const { forFeature } = require('../../domain/providers/generation-presets.cjs');
const { resolvePrompt } = require('../../domain/assistants/prompt-fallbacks.cjs');
const {
  suggestionSource,
  suggestionMessages,
  parseSuggestions,
} = require('../../domain/sessions/follow-up-suggestions.cjs');

// Generates follow-up questions for one answer and refuses the result if the answer changed meanwhile.
function createFollowUpGenerator({ sessions, assistants, providers }) {
  function source(sessionId, entryId, historical = false) {
    const session = sessions.get(sessionId);
    return { session, entry: suggestionSource(session, entryId, historical) };
  }
  return {
    source,
    async ask(settings, { sessionId, entryId }, signal, historical = false) {
      settings = forFeature(settings, 'followUp');
      const { session, entry } = source(sessionId, entryId, historical);
      const guidance = resolvePrompt('followUp', assistants.forSession(session.assistant_id), { settings }).prompt;
      const messages = suggestionMessages(guidance, entry.content);
      signal.throwIfAborted();
      await providers.checkContext(settings, messages, signal);
      signal.throwIfAborted();
      const raw = await providers.stream(settings, messages, () => {}, signal);
      signal.throwIfAborted();
      const fresh = source(sessionId, entryId, historical).entry;
      if (fresh.content !== entry.content) throw new Error('The answer changed. Generate suggestions again.');
      return { entryId, suggestions: parseSuggestions(raw) };
    },
  };
}
module.exports = { createFollowUpGenerator };
