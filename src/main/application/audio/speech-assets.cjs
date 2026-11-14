const { speechLanguages } = require('../../domain/audio/speech-languages.cjs');

// Apple Speech language assets can be installed or released only while no session is live. Capabilities describe the
// primary language when the setting is automatic.
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
    capabilities: () => nativeSpeech.capabilities(speechLanguages(settings().appleSpeechLocale).primary),
  };
}
module.exports = { createSpeechAssets };
