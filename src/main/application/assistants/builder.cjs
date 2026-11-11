const { buildMessages, parseBuilderReply } = require('../../domain/assistants/builder-reply.cjs');

// One assistant-builder exchange with the model: the context is checked before streaming, and a cancelled turn
// never returns a draft.
function createAssistantBuilder({ providers, assistants = () => [], newToken }) {
  return {
    async build(settings, input, signal) {
      const messages = buildMessages(input);
      signal.throwIfAborted();
      await providers.checkContext(settings, messages, signal);
      signal.throwIfAborted();
      const raw = await providers.stream(settings, messages, () => {}, signal);
      signal.throwIfAborted();
      return parseBuilderReply(raw, input.draft, assistants(), newToken);
    },
  };
}
module.exports = { createAssistantBuilder };
