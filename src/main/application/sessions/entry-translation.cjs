const { forFeature } = require('../../domain/providers/generation-presets.cjs');
const {
  translatableEntry,
  translationTarget,
  translationMessages,
  translationText,
} = require('../../domain/sessions/entry-translation.cjs');

// Translates one participant message without saving it, and refuses the result if the message changed meanwhile.
function createEntryTranslation({ sessions, providers }) {
  const source = (sessionId, entryId) => translatableEntry(sessions.get(sessionId), entryId);
  return {
    source,
    async translate(settings, { sessionId, entryId, language }, signal) {
      settings = forFeature(settings, 'translation');
      const target = translationTarget(language);
      const entry = source(sessionId, entryId);
      const messages = translationMessages(target, entry.content);
      signal.throwIfAborted();
      await providers.checkContext(settings, messages, signal);
      signal.throwIfAborted();
      const raw = await providers.stream(settings, messages, () => {}, signal);
      signal.throwIfAborted();
      const text = translationText(raw);
      if (source(sessionId, entryId).content !== entry.content)
        throw new Error('The transcript changed. Translate it again.');
      return { entryId, language: target, text };
    },
  };
}
module.exports = { createEntryTranslation };
