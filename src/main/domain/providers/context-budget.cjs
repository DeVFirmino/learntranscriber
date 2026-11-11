const DEFAULT_CONTEXT_SIZE = 4096;
const SAFETY_TOKENS = 128;

function contextSize(value = DEFAULT_CONTEXT_SIZE) {
  if (!Number.isInteger(value) || value < 512 || value > 131072)
    throw new Error('Choose a local context size from 512 to 131,072 tokens.');
  return value;
}

function completionOptions(settings) {
  if (!settings.managedLocal)
    return settings.localVoice ? { max_tokens: 384, chat_template_kwargs: { enable_thinking: false } } : {};
  return {
    max_tokens: Math.min(
      settings.localVoice ? 384 : 512,
      settings.generationConfig?.maxOutputTokens || 512,
      Math.floor(contextSize(settings.contextSize) / 4),
    ),
    chat_template_kwargs: { enable_thinking: false },
  };
}

class ContextWindowError extends Error {
  constructor(budget) {
    super(
      `The local prompt needs ${budget.promptTokens} tokens, but only ${budget.inputTokens} fit after reserving the response. Compact older history, shorten the request or attachments, or restart with a larger context.`,
    );
    this.code = 'CONTEXT_WINDOW_EXCEEDED';
    this.budget = budget;
  }
}

// How a measured prompt fits the managed local context once the response and a safety margin are reserved.
function promptBudget(settings, promptTokens) {
  const capacity = contextSize(settings.contextSize),
    outputTokens = completionOptions(settings).max_tokens;
  const budget = {
    contextSize: capacity,
    promptTokens,
    outputTokens,
    safetyTokens: SAFETY_TOKENS,
    inputTokens: capacity - outputTokens - SAFETY_TOKENS,
  };
  if (budget.promptTokens > budget.inputTokens) throw new ContextWindowError(budget);
  return budget;
}

module.exports = { DEFAULT_CONTEXT_SIZE, contextSize, completionOptions, promptBudget, ContextWindowError };
