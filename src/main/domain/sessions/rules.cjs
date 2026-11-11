// Which provider and models a session records, from the settings and the running local models.
function sessionMetadata(settings, runtimes) {
  return {
    provider: settings.provider,
    model: settings.provider === 'local' ? runtimes?.llm?.modelId || null : settings.model || null,
    analysisModelSource: settings.provider,
    transcriptionModel:
      settings.transcriptionProvider === 'apple'
        ? `Apple Speech (${settings.appleSpeechLocale})`
        : settings.transcriptionProvider === 'local'
          ? runtimes?.whisper?.modelId || null
          : settings.transcriptionModel || null,
  };
}
function changesSessionModel(patch) {
  return Object.hasOwn(patch, 'provider') || Object.hasOwn(patch, 'model');
}
module.exports = { sessionMetadata, changesSessionModel };
