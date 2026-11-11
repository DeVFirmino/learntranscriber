const { randomUUID } = require('node:crypto');
const { createAssistantBuilder } = require('../application/assistants/builder.cjs');
const { createAppliedProposals } = require('../application/assistants/applied-proposals.cjs');
const { createAssistantLibrary } = require('../application/assistants/manage.cjs');
const { createBuiltInChoice } = require('../application/assistants/built-in-choice.cjs');
const { registerAssistantLibrary } = require('../interface/ipc/assistants.cjs');
const { createAssistantBuild } = require('../application/assistants/build.cjs');
const { createProposalApplication } = require('../application/assistants/apply-proposal.cjs');
const { registerAssistantBuilder } = require('../interface/ipc/assistant-builder.cjs');

// Wires the assistant library and the assistant builder to their IPC channels. The builder and the proposal
// application share one record of applied proposals.
function composeAssistants({
  handle,
  repositories,
  providers,
  route,
  requests,
  clipboard,
  saveSettings,
  callers,
  changed,
}) {
  const { assistants, settings } = repositories;
  const applied = createAppliedProposals();
  const builder = createAssistantBuilder({ providers, assistants: () => assistants.all(), newToken: randomUUID });
  registerAssistantLibrary(
    handle,
    createAssistantLibrary({ assistants, clipboard, changed }),
    createBuiltInChoice({
      assistants,
      recordChoice: () => settings.update({ assistantsChosen: true }),
      changed,
    }),
  );
  registerAssistantBuilder(handle, {
    requests,
    build: createAssistantBuild({
      settings: () => settings.read(),
      builder: () => builder,
      route,
      proposals: applied,
    }),
    proposals: createProposalApplication({ applied, library: assistants, saveSettings, changed }),
    isMainWindow: callers.isMain,
  });
}
module.exports = { composeAssistants };
