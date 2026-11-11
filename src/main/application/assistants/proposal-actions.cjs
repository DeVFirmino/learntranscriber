const { normalizeDraft } = require('../../domain/assistants/draft.cjs');
const { PERSISTENT } = require('../../domain/assistants/builder-commands.cjs');
const { str, findAssistant, assistantDraft } = require('../../domain/assistants/library-lookup.cjs');

const LIBRARY_FIELDS = {
  system_prompt: 'systemPrompt',
  follow_up_prompt: 'followUpPrompt',
  realtime_prompt: 'realtimePrompt',
  email_prompt: 'emailPrompt',
  assistant_context: 'context',
};
const INCOMPLETE = 'The assistant needs a name and system instructions. Your previous draft was kept.';

function draftToAssistant(draft, id) {
  return {
    id,
    name: draft.name,
    prompt: draft.systemPrompt,
    category: draft.category,
    realtimePrompt: draft.realtimePrompt,
    followUpPrompt: draft.followUpPrompt,
    emailPrompt: draft.emailPrompt,
    context: draft.context,
    requireCertainty: draft.requireCertainty,
  };
}

function saveNew(library, draft) {
  if (!draft.name || !draft.systemPrompt) throw new Error(INCOMPLETE);
  return library.save(draftToAssistant(draft));
}

function createdDraft(args) {
  return normalizeDraft({
    name: str(args.assistant_name, 80),
    category: str(args.category, 80),
    ...Object.fromEntries(
      Object.entries(LIBRARY_FIELDS).map(([key, field]) => [
        field,
        str(args[key], field === 'context' ? 100000 : 20000),
      ]),
    ),
    requireCertainty: typeof args.only_reply_when_certain === 'boolean' ? args.only_reply_when_certain : undefined,
  });
}

function updateExisting(library, item, args) {
  const changes = Object.fromEntries(
    Object.entries(LIBRARY_FIELDS)
      .filter(([key]) => str(args[key], key === 'assistant_context' ? 100000 : 20000) !== undefined)
      .map(([key, field]) => [field, args[key]]),
  );
  const name = str(args.new_assistant_name, 80)?.trim(),
    category = str(args.category, 80)?.trim();
  if (name) changes.name = name;
  if (category) changes.category = category;
  if (typeof args.only_reply_when_certain === 'boolean') changes.requireCertainty = args.only_reply_when_certain;
  if (!Object.keys(changes).length) throw new Error('Provide at least one field to update.');
  const draft = normalizeDraft({ ...assistantDraft(item), ...changes });
  if (!draft.name || !draft.systemPrompt) throw new Error(INCOMPLETE);
  library.save(draftToAssistant(draft, item.id));
  return draft.name;
}

/** Executes one reviewed proposal against the assistant library and reports the real outcome. */
function applyProposal(library, proposal, draftInput, { saveSettings } = {}) {
  if (!proposal || !PERSISTENT.has(proposal.tool)) throw new Error('Unsupported builder action.');
  const args = proposal.args && typeof proposal.args === 'object' ? proposal.args : {};
  if (proposal.tool === 'save_assistant_draft') {
    const draft = normalizeDraft(draftInput);
    return { tool: proposal.tool, id: saveNew(library, draft), name: draft.name };
  }
  if (proposal.tool === 'create_assistant') {
    const draft = createdDraft(args);
    return { tool: proposal.tool, id: saveNew(library, draft), name: draft.name };
  }
  const item = findAssistant(library.all(), args);
  if (!item) throw new Error('Assistant not found.');
  if (proposal.tool === 'use_assistant') {
    if (!saveSettings) throw new Error('Unsupported builder action.');
    saveSettings({ assistantId: item.id });
    return { tool: proposal.tool, id: item.id, name: item.name };
  }
  if (proposal.tool === 'delete_assistant') {
    if (args.confirmed !== true) throw new Error('Confirm the deletion explicitly before deleting an assistant.');
    library.delete(item.id);
    return { tool: proposal.tool, id: item.id, name: item.name };
  }
  if (proposal.tool === 'update_assistant_category') {
    const category = str(args.category, 80)?.trim();
    if (!category) throw new Error('Choose a category.');
    library.save(draftToAssistant(normalizeDraft({ ...assistantDraft(item), category }), item.id));
    return { tool: proposal.tool, id: item.id, name: item.name, category };
  }
  return { tool: proposal.tool, id: item.id, name: updateExisting(library, item, args) };
}

module.exports = { applyProposal };
