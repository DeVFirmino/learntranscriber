import { useMemo } from 'react'
import { SettingsIcon } from '../settings-icon'
import { useSettingsT } from '../use-settings-t'
import { AddLanguage } from './apple-speech/add-language'
import { ReservedLocales } from './apple-speech/reserved-locales'
import { SpeechOnboarding } from './apple-speech/speech-onboarding'
import {
  STATUS_KEYS,
  describeLocale,
  downloadableLocales,
  reservedLocales,
  speechStatus,
  statusTone,
  tag,
} from './apple-speech/speech-locales'
import { useSpeechAssets } from './apple-speech/use-speech-assets'

// Apple Speech (6862 case "apple_speech"): readiness, reserved languages and the add-language picker.
export function AppleSpeechPage() {
  const { st, language } = useSettingsT()
  const speech = useSpeechAssets()
  const { capabilities, assets, installing } = speech
  const downloadable = useMemo(() => downloadableLocales(assets, language), [assets, language])
  const reserved = useMemo(() => reservedLocales(assets, language), [assets, language])
  if (capabilities?.authorization !== 'authorized')
    return (
      <SpeechOnboarding
        denied={capabilities?.authorization === 'denied' || capabilities?.authorization === 'restricted'}
        loading={speech.loading}
        onGrant={speech.grant}
        onOpenSettings={speech.openSettings}
      />
    )
  const status = speechStatus(capabilities, assets, installing)
  const installed = assets?.installedLocales || []
  return (
    <div className="setting-group compact">
      <div className="local-provider-content">
        <section className="local-engine-card active">
          <div className="local-preview-status-row">
            <span className={`local-preview-status-pill ${statusTone(status)}`}>{st(STATUS_KEYS[status])}</span>
          </div>
          <div className="local-preview-stats">
            <div className="local-preview-stat">
              <span className="local-preview-stat-label">{st('settings.api.localModels.appleSpeechLocale')}</span>
              <span className="local-preview-stat-value">
                {capabilities.locale
                  ? tag(capabilities.locale)
                  : st('settings.api.localModels.appleSpeechLocaleSystem')}
              </span>
            </div>
            <div className="local-preview-stat">
              <span className="local-preview-stat-label">{st('settings.api.localModels.appleSpeechReadyOnMac')}</span>
              <span className="local-preview-stat-value">
                {installed.length || st('settings.api.localModels.summaryNoLanguageInstalled')}
              </span>
            </div>
          </div>
          <div className="local-engine-card-details">
            <div className="apple-speech-locale-section">
              <div className="apple-speech-locale-section-header">
                <div>
                  <div className="apple-speech-locale-section-title">
                    {st('settings.api.localModels.appleSpeechLocalesTitle')}
                  </div>
                  <div className="apple-speech-locale-section-description">
                    {st('settings.api.localModels.appleSpeechLocalesDescription')}
                  </div>
                </div>
              </div>
              {assets?.assetManagementAvailable ? (
                <ReservedLocales
                  reserved={reserved}
                  maximum={assets.maximumReservedLocales || 0}
                  releasing={speech.releasing}
                  onRelease={speech.release}
                />
              ) : null}
              {speech.error ? (
                <div className="error-message glass-panel-medium">
                  <SettingsIcon name="error" />
                  <span>{speech.error}</span>
                  <button className="dismiss-btn" onClick={speech.dismissError}>
                    <SettingsIcon name="close" />
                  </button>
                </div>
              ) : null}
              {speech.loading ? (
                <div className="apple-speech-locale-empty">
                  <SettingsIcon name="sync" className="spinning" />
                  <span>{st('settings.api.localModels.appleSpeechLocalesLoading')}</span>
                </div>
              ) : (
                <AddLanguage
                  downloading={installing ? describeLocale(installing, language) : null}
                  downloadable={downloadable}
                  managed={Boolean(assets?.assetManagementAvailable)}
                  onInstall={speech.install}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
// keys: settings.api.localModels.appleSpeechAssetReady settings.api.localModels.appleSpeechAssetDownloadable
// keys: settings.api.localModels.appleSpeechAssetDownloading settings.api.localModels.appleSpeechAssetUnavailable
