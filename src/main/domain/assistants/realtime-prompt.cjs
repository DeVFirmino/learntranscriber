// The realtime ("meta") route: when the session assistant has no realtime prompt, one meta request turns its system
// prompt into a live-response instruction before the first realtime summary. The meta prompt, its user message and
// the default instruction are fixed text, kept in domain/sessions/notch-insight-prompts.json.
const { PROMPTS } = require('../sessions/notch-insight.cjs');
const { outputLanguage, withLanguageRequirement } = require('../sessions/compaction.cjs');

const META_SYSTEM = PROMPTS.metaPrompt;

function metaUserMessage(systemPrompt, languageInstruction) {
  return PROMPTS.metaUser.replace('{{role}}', () => systemPrompt).replace('{{language}}', () => languageInstruction);
}

// The instruction used with a local model, which skips the meta request; a failed meta request leaves none, and the
// insight then uses the same default without the language and assistant additions.
function fallbackInstruction() {
  return PROMPTS.instructions;
}

// The language instruction for the teleprompter output, in the output language.
function languageInstruction(settings) {
  return withLanguageRequirement('', outputLanguage(settings), 'teleprompter output').split(
    'FINAL LANGUAGE REQUIREMENT:\n',
  )[1];
}

module.exports = { META_SYSTEM, metaUserMessage, fallbackInstruction, languageInstruction };
