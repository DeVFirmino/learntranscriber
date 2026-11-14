// Apple Speech needs one language per recognizer and cannot detect it, so the automatic setting listens with one
// recognizer per language here, the primary first.
const AUTO_SPEECH_LOCALE = 'auto';
const AUTO_SPEECH_LOCALES = Object.freeze(['en-US', 'pt-BR']);

// The languages a saved Apple Speech setting listens in: automatic is the primary and its alternate; any other value is
// itself alone.
function speechLanguages(setting) {
  if (setting === AUTO_SPEECH_LOCALE) return { primary: AUTO_SPEECH_LOCALES[0], alternate: AUTO_SPEECH_LOCALES[1] };
  return { primary: setting, alternate: null };
}

// How a session names the setting: "Auto EN + PT" for automatic, otherwise the language itself.
function speechLanguageLabel(setting) {
  if (setting !== AUTO_SPEECH_LOCALE) return setting;
  return `Auto ${AUTO_SPEECH_LOCALES.map((locale) => locale.slice(0, 2).toUpperCase()).join(' + ')}`;
}

module.exports = { AUTO_SPEECH_LOCALE, AUTO_SPEECH_LOCALES, speechLanguages, speechLanguageLabel };
