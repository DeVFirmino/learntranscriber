const { normalizeDraft } = require('./draft.cjs');
const { str, searchLibrary, findAssistant, assistantDraft } = require('./library-lookup.cjs');

const PROMPTS = {
  system: 'systemPrompt',
  realtime: 'realtimePrompt',
  notch: 'realtimePrompt',
  follow_up: 'followUpPrompt',
  followup: 'followUpPrompt',
  email: 'emailPrompt',
};
// Library commands the user must review and apply; the builder only proposes them.
const PERSISTENT = new Set([
  'save_assistant_draft',
  'create_assistant',
  'update_existing_assistant',
  'update_assistant_category',
  'delete_assistant',
  'use_assistant',
]);

const merge = (current, content, strategy) =>
  strategy === 'append' && current.trim() ? `${current.trim()}\n\n${content}` : content;

function applyDraftCommand(draft, command) {
  const args = command.args || {};
  if (command.tool === 'update_assistant_prompt') {
    const field = PROMPTS[String(args.prompt_type || '').toLowerCase()],
      content = str(args.content)?.trim();
    if (!field) throw new Error('Choose a supported prompt type.');
    if (!content) throw new Error('Prompt content cannot be empty.');
    return { ...draft, [field]: merge(draft[field] || '', content, args.strategy) };
  }
  if (command.tool === 'update_assistant_settings') {
    const next = { ...draft },
      name = str(args.assistant_name, 80)?.trim(),
      category = str(args.category, 80)?.trim();
    if (name) next.name = name;
    if (category) next.category = category;
    if (typeof args.only_reply_when_certain === 'boolean') next.requireCertainty = args.only_reply_when_certain;
    if (
      next.name === draft.name &&
      next.category === draft.category &&
      next.requireCertainty === draft.requireCertainty
    )
      throw new Error('Provide a name, category or certainty setting to change.');
    return next;
  }
  if (command.tool === 'update_assistant_context') {
    if (args.clear === true) return { ...draft, context: '' };
    const content = str(args.content, 100000)?.trim();
    if (!content) throw new Error('Context content cannot be empty; use clear to remove it.');
    return { ...draft, context: merge(draft.context || '', content, args.strategy) };
  }
  throw new Error('Unsupported draft command.');
}

// Models mix naming styles: camelCase keys become the documented snake_case, `name` names a new assistant, and a
// certainty flag may arrive as text. Deletion confirmation is deliberately not coerced; it must be literal true.
function normalizeArgs(command) {
  if (
    !command ||
    typeof command !== 'object' ||
    !command.args ||
    typeof command.args !== 'object' ||
    Array.isArray(command.args)
  )
    return command;
  const args = {};
  for (const [key, value] of Object.entries(command.args)) {
    const snake = key.replace(/[A-Z]/g, (letter) => '_' + letter.toLowerCase());
    if (!(snake in args) || key === snake) args[snake] = value;
  }
  if (
    args.assistant_name === undefined &&
    typeof args.name === 'string' &&
    command.tool !== 'update_existing_assistant'
  )
    args.assistant_name = args.name;
  if (args.only_reply_when_certain === undefined && args.require_certainty !== undefined)
    args.only_reply_when_certain = args.require_certainty;
  const certain = String(args.only_reply_when_certain ?? '')
    .trim()
    .toLowerCase();
  if (certain === 'true' || certain === 'false') args.only_reply_when_certain = certain === 'true';
  return { ...command, args };
}

/**
 * Applies draft edits and read-only searches; persistent commands become proposals the user must apply, each
 * carrying a token from newToken.
 */
function runCommands(commands, draftInput, assistants, newToken) {
  if (!Array.isArray(commands) || commands.length > 8) throw new Error('The model returned too many builder commands.');
  let draft = normalizeDraft(draftInput),
    finished = false;
  const results = [],
    proposals = [];
  for (const raw of commands) {
    const command = normalizeArgs(raw);
    if (!command || typeof command !== 'object' || typeof command.tool !== 'string')
      throw new Error('The model returned an invalid builder command.');
    const args = command.args && typeof command.args === 'object' && !Array.isArray(command.args) ? command.args : {};
    if (command.tool === 'search_assistant_library')
      results.push({ tool: command.tool, assistants: searchLibrary(assistants, args) });
    else if (command.tool === 'open_assistant_for_editing') {
      const item = findAssistant(assistants, args);
      if (!item) throw new Error('Assistant not found.');
      draft = normalizeDraft(assistantDraft(item));
      results.push({ tool: command.tool, assistant: { id: item.id, name: item.name } });
    } else if (command.tool === 'finish_assistant_builder') finished = true;
    else if (PERSISTENT.has(command.tool)) proposals.push({ tool: command.tool, args, token: newToken() });
    else draft = applyDraftCommand(draft, { tool: command.tool, args });
  }
  return { draft, results, proposals, finished };
}

module.exports = { runCommands, applyDraftCommand, PERSISTENT };
