import type { SpeechAssets } from '../../../bridge/types/audio'

export type Capabilities = { locale: string; supportsOnDeviceRecognition: boolean; authorization: string }
export type SpeechStatus = 'ready' | 'downloadable' | 'downloading' | 'unsupported'

export const tag = (locale: string) => locale.replaceAll('_', '-')
export const sameLocale = (a: string, b: string) => tag(a).toLowerCase() === tag(b).toLowerCase()

// Names a locale in the interface language and flags it by its region.
export function describeLocale(locale: string, language: string) {
  let displayName = tag(locale)
  try {
    displayName =
      new Intl.DisplayNames([language === 'pt-BR' ? 'pt-BR' : language], { type: 'language' }).of(tag(locale)) ||
      displayName
  } catch {
    // Unknown tags keep their identifier.
  }
  const region = tag(locale)
    .split('-')
    .slice(1)
    .find((part) => /^[A-Za-z]{2}$/.test(part))
  const flag = region
    ? String.fromCodePoint(...[...region.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65))
    : ''
  return { identifier: locale, displayName, flag }
}

const byName = (a: { displayName: string }, b: { displayName: string }) => a.displayName.localeCompare(b.displayName)

// The languages macOS can still download, and the ones this app has reserved, by name.
export function downloadableLocales(assets: SpeechAssets | null, language: string) {
  const installed = assets?.installedLocales || []
  return (assets?.locales || [])
    .filter((locale) => !installed.some((item) => sameLocale(item, locale)))
    .map((locale) => describeLocale(locale, language))
    .sort(byName)
}

export function reservedLocales(assets: SpeechAssets | null, language: string) {
  return (assets?.reservedLocales || []).map((locale) => describeLocale(locale, language)).sort(byName)
}

// Whether the recognition language is ready on this Mac: downloading now, installed, downloadable, or not supported.
export function speechStatus(
  capabilities: Capabilities | null,
  assets: SpeechAssets | null,
  installing: string,
): SpeechStatus {
  if (installing) return 'downloading'
  if (!capabilities?.supportsOnDeviceRecognition) return 'unsupported'
  if ((assets?.installedLocales || []).some((item) => sameLocale(item, capabilities.locale))) return 'ready'
  if ((assets?.locales || []).some((item) => sameLocale(item, capabilities.locale))) return 'downloadable'
  return 'unsupported'
}

export const STATUS_KEYS: Record<SpeechStatus, string> = {
  ready: 'settings.api.localModels.appleSpeechAssetReady',
  downloadable: 'settings.api.localModels.appleSpeechAssetDownloadable',
  downloading: 'settings.api.localModels.appleSpeechAssetDownloading',
  unsupported: 'settings.api.localModels.appleSpeechAssetUnavailable',
}

// The status pill: ready is green, a language still to download is a warning, anything else neutral.
export function statusTone(status: SpeechStatus) {
  if (status === 'ready') return 'ready'
  if (status === 'downloadable' || status === 'downloading') return 'warn'
  return 'neutral'
}
