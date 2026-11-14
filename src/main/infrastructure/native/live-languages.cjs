const { speechLanguages } = require('../../domain/audio/speech-languages.cjs');

// The languages a live Apple Speech session asks for: the saved setting, its primary (US English when blank) and the
// alternate the automatic setting adds.
function requestedLanguages(setting) {
  const { primary, alternate } = speechLanguages(String(setting || '').trim());
  return { setting, locale: primary || 'en-US', alternate };
}

// Checks the languages with the helper before a session listens. The primary must be allowed and able to stream; an
// alternate that cannot stream, or whose check fails, is dropped so the session listens in the primary alone. A
// cancelled startup skips the alternate's check.
async function preflightLanguages(languages, { preflight, cancelled }) {
  const result = await preflight(languages.locale);
  if (result.authorization === 'denied' || result.authorization === 'restricted')
    throw new Error('Enable Speech Recognition for LearnTranscriber in macOS Privacy & Security.');
  if (!result.supportsStreamingRecognition) throw new Error('Streaming Apple Speech is unavailable for this language.');
  if (!languages.alternate || cancelled()) return languages;
  const alternate = await preflight(languages.alternate).catch(() => null);
  return { ...languages, alternate: alternate?.supportsStreamingRecognition ? languages.alternate : null };
}

module.exports = { requestedLanguages, preflightLanguages };
