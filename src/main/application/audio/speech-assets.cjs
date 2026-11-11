// Apple Speech language assets can be installed or released only while no session is live.
function createSpeechAssets({ active, settings, nativeSpeech }) {
  return {
    assets: () => nativeSpeech.assets(),
    manageLocale(input) {
      if (active.id()) throw new Error('End the active session before installing or releasing Apple Speech languages.');
      return nativeSpeech.manageLocale(input.operation, input.locale, {
        preserveExisting: input.preserveExisting === true,
      });
    },
    cancel() {
      nativeSpeech.cancelAssetOperation();
      return true;
    },
    capabilities: () => nativeSpeech.capabilities(settings().appleSpeechLocale),
  };
}
module.exports = { createSpeechAssets };
