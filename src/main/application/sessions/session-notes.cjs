const { forFeature } = require('../../domain/providers/generation-presets.cjs');
const { resolvePrompt } = require('../../domain/assistants/prompt-fallbacks.cjs');
const { outputLanguage } = require('../../domain/sessions/compaction.cjs');
const { noteMessages, noteFileName, noteDocument } = require('../../domain/sessions/session-note.cjs');

// Saves a session's summary and handoff as a Markdown file in the notes folder, on the chosen model. Only files this
// run saved can be opened again from the floating assistant.
function createSessionNotes({ settings, sessions, assistants, providers, route, files, now }) {
  const saved = new Set();
  return {
    folder: () => files.folder(settings()),
    async save({ sessionId }, signal) {
      const current = settings();
      const session = sessions.get(sessionId);
      if (!session) throw new Error('Session not found.');
      const assistant = assistants.forSession(session.assistant_id);
      // The automatic note brings its own detailed guidance; the short default TL;DR would cut it down. An assistant's
      // or the user's own summary guidance still applies.
      const guidance = resolvePrompt('email', assistant, { settings: current });
      const automatic = current.sessionNoteTemplate === 'auto' && guidance.source === 'built-in default';
      const messages = noteMessages({
        session,
        summaryGuidance: automatic ? '' : guidance.prompt,
        language: outputLanguage(current),
        template: current.sessionNoteTemplate,
      });
      const body = await route.run(
        current,
        async (chosen) => {
          chosen = forFeature(chosen, 'summary');
          signal.throwIfAborted();
          await providers.checkContext(chosen, messages, signal);
          signal.throwIfAborted();
          return providers.stream(chosen, messages, () => {}, signal);
        },
        { signal },
      );
      if (!String(body || '').trim()) throw new Error('The model returned an empty note. Try again.');
      signal.throwIfAborted();
      const date = now();
      const path = await files.write(current, noteFileName(session, date), noteDocument(session, body, date));
      saved.add(path);
      return { path };
    },
    open(path) {
      if (!saved.has(path)) throw new Error('Only a note saved in this session can be opened.');
      return files.open(path);
    },
  };
}
module.exports = { createSessionNotes };
