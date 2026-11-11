// Built-in assistants are identified by id only: a custom assistant with the same name is never merged into one.
const BUILT_IN_ASSISTANTS = [
  require('./built-ins/general.cjs'),
  require('./built-ins/math.cjs'),
  require('./built-ins/english.cjs'),
  require('./built-ins/programming.cjs'),
  require('./built-ins/meeting.cjs'),
];
const BUILT_IN_IDS = BUILT_IN_ASSISTANTS.map((assistant) => assistant.id);

// The defaults every earlier build seeded. A row still equal to one was never edited, so the catalog may replace it.
const LEGACY_DEFAULTS = {
  general: {
    name: 'General assistant',
    prompt:
      'Help the user understand the conversation and respond clearly. Ground answers in the supplied session. Distinguish facts from suggestions.',
  },
  study: {
    name: 'Study companion',
    prompt: 'Explain concepts clearly and help the user learn. Use the session as context and give practical examples.',
  },
  meeting: {
    name: 'Meeting notes',
    prompt:
      'Extract decisions, open questions, and next steps from the conversation. Do not invent facts or assign owners without evidence.',
  },
};

const EXTRA_FIELDS = [
  'realtime_prompt',
  'follow_up_prompt',
  'email_prompt',
  'mcp_determination_prompt',
  'mcp_interpretation_prompt',
  'mcp_next_action_prompt',
  'context',
];

function untouchedLegacy(row) {
  const legacy = LEGACY_DEFAULTS[row.id];
  return Boolean(
    legacy &&
    row.name === legacy.name &&
    row.prompt === legacy.prompt &&
    EXTRA_FIELDS.every((field) => !row[field]) &&
    !row.require_certainty &&
    (row.knowledge_files || '[]') === '[]' &&
    (row.mcp_servers || '[]') === '[]',
  );
}

// What to do with a stored legacy row: an edited one is kept as the user left it; an untouched one becomes its
// catalog successor, or is retired when the catalog has none (the study companion became subject assistants).
function legacyUpgrade(row) {
  if (!untouchedLegacy(row)) return { action: 'keep' };
  const successor = BUILT_IN_ASSISTANTS.find((assistant) => assistant.id === row.id);
  return successor ? { action: 'replace', assistant: successor } : { action: 'retire' };
}

module.exports = { BUILT_IN_ASSISTANTS, BUILT_IN_IDS, LEGACY_DEFAULTS, legacyUpgrade };
