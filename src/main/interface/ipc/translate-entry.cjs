const { text } = require('../../domain/shared/text.cjs');

function registerEntryTranslation(handle, { requests, translator }) {
  handle('ai:translate-entry', (event, input) => {
    const id = text(input?.requestId, 100),
      sessionId = text(input?.sessionId, 100),
      entryId = text(input?.entryId, 100);
    return requests.run(
      { id, owner: event.sender.id, sessionId, mode: 'entryTranslation', timeoutMs: 90000 },
      (signal) => translator.translate({ sessionId, entryId, language: input.language }, signal),
    );
  });
}
module.exports = { registerEntryTranslation };
