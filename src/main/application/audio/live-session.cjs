// Live captions for the active session, from Apple Speech, local Whisper, OpenAI streaming or Gemini Live. Each window owns
// at most one live session, and pushes, language changes and stops go to whichever engine that window started.
function createLiveSessions({ active, settings, apple, whisper, realtime, gemini }) {
  const paused = new Set();
  const engineFor = (owner) =>
    apple.owns(owner) ? apple : realtime?.owns(owner) ? realtime : gemini?.owns(owner) ? gemini : whisper;
  return {
    start(owner, id) {
      paused.delete(owner);
      if (id !== active.id()) throw new Error('Start or resume this session first.');
      const provider = settings().transcriptionProvider;
      if (provider === 'apple') return apple.start(owner, id);
      if (provider === 'openai' && realtime) return realtime.start(owner, id);
      if (provider === 'gemini' && gemini) return gemini.start(owner, id);
      return whisper.start(owner, id);
    },
    push(owner, input) {
      if (input?.sessionId !== active.id()) throw new Error('This session is no longer active.');
      if (paused.has(owner)) return true;
      return engineFor(owner).push(owner, input);
    },
    setPaused(owner, value) {
      if (typeof value !== 'boolean') throw new Error('Invalid pause state.');
      const engine = engineFor(owner);
      if (!engine.owns(owner)) throw new Error('Live transcription is no longer active.');
      if (value) paused.add(owner);
      else paused.delete(owner);
      if (engine === apple) apple.setPaused(owner, value);
      return true;
    },
    stop(owner) {
      paused.delete(owner);
      return engineFor(owner).stop(owner);
    },
    updateLanguage(owner, input) {
      if (input?.sessionId !== active.id()) throw new Error('Start or resume this session first.');
      const engine = realtime?.owns(owner) ? realtime : gemini?.owns(owner) ? gemini : whisper;
      return engine.updateLanguage(owner, input.sessionId, input.language, input.prompt);
    },
  };
}
module.exports = { createLiveSessions };
