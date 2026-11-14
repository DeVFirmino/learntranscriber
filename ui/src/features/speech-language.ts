// Apple Speech's automatic setting listens in English and Portuguese at once; the main process maps it to both
// recognizers (src/main/domain/audio/speech-languages.cjs).
export const AUTO_SPEECH_LOCALE = 'auto'

const SPEECH_LOCALES = ['pt-BR', 'en-US', 'es-ES']

// The floating panel's recognition languages: automatic first, then the saved language when it is another one, then
// the common ones.
export function speechLanguageOptions(current: string) {
  return [...new Set([AUTO_SPEECH_LOCALE, current, ...SPEECH_LOCALES])]
}
