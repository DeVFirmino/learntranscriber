// Translating one entry is read-only. It refuses a language the settings no longer ask for, and may use a
// dedicated translation provider instead of the main one.
function createEntryTranslator({ settings, translation, route }) {
  return {
    async translate({ sessionId, entryId, language }, signal) {
      const current = settings();
      if (!current.translationLanguage.trim()) throw new Error('Translation is off. Choose a language in Settings.');
      if (language !== current.translationLanguage) throw new Error('Translation language changed. Try again.');
      const chosen = current.translationProvider
        ? { ...current, provider: current.translationProvider, model: current.translationModel }
        : current;
      return route.run(
        chosen,
        (resolved) => translation().translate(resolved, { sessionId, entryId, language }, signal),
        { signal },
      );
    },
  };
}
module.exports = { createEntryTranslator };
