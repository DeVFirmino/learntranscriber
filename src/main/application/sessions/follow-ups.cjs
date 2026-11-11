// Suggested follow-up questions for one answer. The source entry is checked before a local model is leased.
function createFollowUpSuggestions({ settings, followUps, route }) {
  return {
    async ask({ sessionId, entryId, historical }, signal) {
      const current = settings(),
        suggestions = followUps();
      suggestions.source(sessionId, entryId, historical);
      return route.run(current, (chosen) => suggestions.ask(chosen, { sessionId, entryId }, signal, historical), {
        signal,
      });
    },
  };
}
module.exports = { createFollowUpSuggestions };
