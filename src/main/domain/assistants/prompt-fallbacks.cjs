// User-global prompts are settings; an empty global prompt falls back to the packaged default.
// Realtime callers supply a generated or fallback instruction (see realtime-prompt.cjs).
const BUILT_IN_DEFAULTS = Object.freeze({
  system: 'You are a helpful AI assistant.',
  followUp:
    'Generate 3 relevant follow-up questions based on the previous response. Each question should be concise (max 8 words) and explore different aspects. IMPORTANT: Generate the questions in the SAME LANGUAGE as the previous response.',
  email:
    "Create a TLDR (Too Long; Didn't Read) summary that captures the essence of the conversation. Include: 1) Main topics discussed, 2) Key questions asked by the user, 3) Important solutions or insights provided, 4) Any action items or next steps mentioned. Keep it concise but comprehensive.",
});

// Prompt path → stored assistant column, user-global setting and fallback.
const FIELDS = Object.freeze({
  system: { column: 'prompt', fallback: 'built-in' },
  realtime: { column: 'realtime_prompt', fallback: 'local' },
  followUp: { column: 'follow_up_prompt', global: 'globalFollowUpPrompt', fallback: 'built-in' },
  email: { column: 'email_prompt', global: 'globalEmailPrompt', fallback: 'built-in' },
});

// Returns the text a prompt path should use and where it came from: 'assistant', 'user global',
// 'built-in default', or 'local default' (empty text when the local fallback adds nothing).
function resolvePrompt(field, assistant, { settings = {}, localDefault = '' } = {}) {
  const spec = FIELDS[field];
  if (!spec) throw new Error(`Unknown assistant prompt field: ${field}.`);
  const own = String(assistant?.[spec.column] ?? '').trim();
  if (own) return { prompt: own, source: 'assistant' };
  const global = spec.global ? String(settings?.[spec.global] ?? '').trim() : '';
  if (global) return { prompt: global, source: 'user global' };
  if (spec.fallback === 'built-in') return { prompt: BUILT_IN_DEFAULTS[field], source: 'built-in default' };
  return { prompt: localDefault, source: 'local default' };
}

module.exports = { BUILT_IN_DEFAULTS, FIELDS, resolvePrompt };
