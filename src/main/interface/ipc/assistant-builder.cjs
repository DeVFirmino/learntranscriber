const { text } = require('../../domain/shared/text.cjs');

// Only the main workspace may apply what the builder proposed; the floating assistant can only read it.
function registerAssistantBuilder(handle, { requests, build, proposals, isMainWindow }) {
  handle('assistants:build', (event, input) => {
    const id = text(input?.requestId, 100);
    return requests.run({ id, owner: event.sender.id, mode: 'assistantBuilder', timeoutMs: 180000 }, (signal) =>
      build.build(input, signal),
    );
  });
  handle('assistants:apply-builder-action', (event, input) => {
    if (!isMainWindow(event)) throw new Error('Unsupported builder action.');
    return proposals.apply({ proposal: input?.proposal, draft: input?.draft });
  });
}
module.exports = { registerAssistantBuilder };
