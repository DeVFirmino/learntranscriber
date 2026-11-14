// Packaged FULL feature defaults pinned by the 2026-10-28 comparison.
const PRESETS = Object.freeze({
  analysis: { temperature: 0.4, maxOutputTokens: 1500, reasoningEffort: 'medium', reasoningMaxOutputTokens: 3000 },
  analysisGemini: { temperature: 0.4, maxOutputTokens: 3000, thinkingBudget: 0 },
  tldr: { temperature: 0.4, maxOutputTokens: 2048, reasoningEffort: 'medium', reasoningMaxOutputTokens: 4096 },
  // Detailed session notes: a long class needs far more room than a TL;DR, and reasoning models spend part of it.
  summary: { temperature: 0.4, maxOutputTokens: 8000, reasoningEffort: 'medium', reasoningMaxOutputTokens: 12000 },
  mcp: {
    temperature: 0.2,
    maxOutputTokens: 500,
    thinkingBudget: 0,
    reasoningEffort: 'low',
    reasoningMaxOutputTokens: 1024,
  },
  followUp: {
    temperature: 0.7,
    maxOutputTokens: 300,
    thinkingBudget: 0,
    reasoningEffort: 'low',
    reasoningMaxOutputTokens: 768,
  },
  realtimeSummaryMeta: {
    temperature: 0.7,
    maxOutputTokens: 1024,
    reasoningEffort: 'low',
    reasoningMaxOutputTokens: 2048,
  },
  realtimeSummary: { temperature: 0.7, maxOutputTokens: 2048, reasoningEffort: 'none' },
  realtimeSummaryEval: { temperature: 0.1, maxOutputTokens: 15, thinkingBudget: 0, reasoningEffort: 'none' },
  translation: { temperature: 0, maxOutputTokens: 512, thinkingBudget: 0, reasoningEffort: 'none' },
});
for (const preset of Object.values(PRESETS)) Object.freeze(preset);

const MODE_FEATURES = {
  chat: 'analysis',
  screenInsight: 'analysis',
  summary: 'summary',
  practice: 'tldr',
  summaryRewrite: 'summary',
  compact: 'tldr',
  translation: 'translation',
  insight: 'realtimeSummary',
};

function forFeature(settings, feature = 'analysis', overrides = {}) {
  const name = feature === 'analysis' && settings.provider === 'gemini' ? 'analysisGemini' : feature;
  const generationFeature = Object.hasOwn(PRESETS, name) ? name : 'analysis';
  return {
    ...settings,
    generationFeature,
    generationConfig: {
      ...PRESETS[generationFeature],
      ...(settings.generationFeature === generationFeature ? settings.generationConfig : {}),
      ...overrides,
    },
  };
}

function reasoningEffort(settings) {
  // This checks a pinned, known-capable model, not an assumption about every GPT model.
  return /^gpt-5\.6(?:-|$)/i.test(String(settings.model || '').trim())
    ? settings.generationConfig?.reasoningEffort
    : undefined;
}

function outputTokens(settings) {
  const config = settings.generationConfig || {};
  const effort = reasoningEffort(settings);
  return effort && effort !== 'none' && config.reasoningMaxOutputTokens
    ? config.reasoningMaxOutputTokens
    : config.maxOutputTokens;
}

// The o-series and GPT-5 or later are reasoning models: they reject temperature and take max_completion_tokens.
const reasoningModel = (model) => /^(o[1-9]|gpt-([5-9]|\d{2,})(?:[.-]|$))/i.test(String(model || '').trim());

function compatibleOptions(settings) {
  const config = settings.generationConfig;
  if (!config) return {};
  const effort = reasoningEffort(settings);
  const supportsTemperature = !reasoningModel(settings.model) && (!effort || effort === 'none');
  const tokens = outputTokens(settings);
  return {
    ...(supportsTemperature && Number.isFinite(config.temperature) ? { temperature: config.temperature } : {}),
    ...(!settings.managedLocal && !settings.localVoice && tokens
      ? { [reasoningModel(settings.model) ? 'max_completion_tokens' : 'max_tokens']: tokens }
      : {}),
    ...(effort ? { reasoning_effort: effort } : {}),
  };
}

function responseOptions(settings) {
  const compatible = compatibleOptions(settings);
  return {
    ...(compatible.temperature !== undefined ? { temperature: compatible.temperature } : {}),
    ...(outputTokens(settings) ? { max_output_tokens: outputTokens(settings) } : {}),
    ...(compatible.reasoning_effort ? { reasoning: { effort: compatible.reasoning_effort } } : {}),
  };
}

function geminiOptions(settings) {
  const config = settings.generationConfig;
  if (!config) return {};
  const model = String(settings.model || '').replace(/^models\//i, '');
  const pro = /(?:^|[-_])pro(?:[-_]|$)/i.test(model);
  let thinking;
  if (config.thinkingBudget !== undefined) {
    if (config.thinkingBudget !== 0) thinking = { thinkingBudget: config.thinkingBudget };
    else if (/^gemini[-_]3(?:\.\d+)?(?:[-_]|$)/i.test(model)) thinking = { thinkingLevel: pro ? 'low' : 'minimal' };
    else if (/^gemini[-_]2\.5(?:[-_]|$)/i.test(model)) thinking = { thinkingBudget: pro ? 128 : 0 };
    else if (!pro) thinking = { thinkingBudget: 0 };
  }
  return {
    ...(Number.isFinite(config.temperature) ? { temperature: config.temperature } : {}),
    maxOutputTokens: config.maxOutputTokens,
    ...(thinking ? { thinkingConfig: thinking } : {}),
  };
}

module.exports = {
  PRESETS,
  MODE_FEATURES,
  forFeature,
  outputTokens,
  compatibleOptions,
  responseOptions,
  geminiOptions,
};
