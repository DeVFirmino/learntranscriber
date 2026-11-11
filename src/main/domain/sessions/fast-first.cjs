// The fast-first insight: the session-start
// baseline screen read may swap to a faster model of the same provider, with tighter generation limits and a
// smaller screenshot. OpenAI swaps to its mini model, Gemini to Flash-Lite; ChatGPT sign-in
// and every other provider keep the selected model and limits.
const PROVIDER_MODELS = Object.freeze({ openai: 'gpt-5.4-mini', gemini: 'gemini-3.1-flash-lite' });
const GENERATION = Object.freeze({ maxOutputTokens: 420, reasoningEffort: 'none', temperature: undefined });
// Image preset 'fast': longest side 1024 px, JPEG quality 0.82.
const IMAGE = Object.freeze({ maxDimension: 1024, quality: 82 });
// fastFirstInsightDelayMs: the baseline request starts right after the session does.
const DELAY_MS = 1;

function fastFirstModel(provider) {
  return Object.hasOwn(PROVIDER_MODELS, provider) ? PROVIDER_MODELS[provider] : '';
}

// Settings for the baseline request; unchanged when the provider has no fast model.
function fastFirstSettings(settings) {
  const model = fastFirstModel(settings.provider);
  if (!model) return settings;
  return {
    ...settings,
    model,
    fastFirstFallbackModel: settings.model && settings.model !== model ? settings.model : null,
    generationConfig: { ...settings.generationConfig, ...GENERATION },
  };
}

module.exports = { PROVIDER_MODELS, GENERATION, IMAGE, DELAY_MS, fastFirstModel, fastFirstSettings };
