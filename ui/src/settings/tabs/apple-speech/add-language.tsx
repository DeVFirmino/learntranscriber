import { useState } from 'react'
import { SettingsIcon } from '../../settings-icon'
import { useSettingsT } from '../../use-settings-t'
import type { describeLocale } from './speech-locales'

type Locale = ReturnType<typeof describeLocale>

// The language macOS is downloading now; this card shows without a measured progress.
function DownloadCard({ locale }: { locale: Locale }) {
  const { st } = useSettingsT()
  return (
    <div className="apple-speech-download-card">
      <div className="apple-speech-download-header">
        <div className="apple-speech-download-title-row">
          <span className="apple-speech-ready-chip-flag" aria-hidden="true">
            {locale.flag}
          </span>
          <span className="apple-speech-download-title">
            {st('settings.api.localModels.appleSpeechLanguageDownloadingLabel', { locale: locale.displayName })}
          </span>
        </div>
        <span className="apple-speech-locale-pill downloading">
          {st('settings.api.localModels.appleSpeechAssetDownloading')}
        </span>
      </div>
      <div className="download-progress apple-speech-locale-progress">
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: '0%' }} />
        </div>
        <div className="progress-info">
          <span>{st('settings.api.localModels.appleSpeechAssetDownloading')}</span>
          <span>0%</span>
        </div>
      </div>
    </div>
  )
}

// Adding a language: the download in progress, the picker with Download and Cancel, or the Add button when macOS
// lets the app manage its languages.
export function AddLanguage({
  downloading,
  downloadable,
  managed,
  onInstall,
}: {
  downloading: Locale | null
  downloadable: Locale[]
  managed: boolean
  onInstall: (locale: string) => void
}) {
  const { st } = useSettingsT()
  const [picking, setPicking] = useState(false)
  const [choice, setChoice] = useState('')
  const content = () => {
    if (downloading) return <DownloadCard locale={downloading} />
    if (picking)
      return (
        <div className="apple-speech-add-picker">
          <select
            aria-label={st('settings.api.localModels.appleSpeechAddLanguageAction')}
            className="custom-select apple-speech-add-select"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
          >
            {downloadable.map((item) => (
              <option value={item.identifier} key={item.identifier}>
                {item.flag} {item.displayName}
              </option>
            ))}
          </select>
          <button
            className="glass-button-small action-btn download"
            onClick={() => {
              setPicking(false)
              onInstall(choice)
            }}
            disabled={!choice}
          >
            <SettingsIcon name="download" />
            <span>{st('settings.api.localModels.appleSpeechLocaleDownloadAction')}</span>
          </button>
          <button
            className="glass-button-small local-llm-tuning-toggle apple-speech-add-cancel"
            onClick={() => setPicking(false)}
          >
            <span>{st('settings.api.localModels.appleSpeechCancelDownloadAction')}</span>
          </button>
        </div>
      )
    if (!managed) return null
    return (
      <button
        className="glass-button-small local-llm-tuning-toggle apple-speech-add-button"
        onClick={() => {
          setChoice(downloadable[0]?.identifier || '')
          setPicking(true)
        }}
        disabled={!downloadable.length}
      >
        <SettingsIcon name="add" />
        <span>{st('settings.api.localModels.appleSpeechAddLanguageAction')}</span>
      </button>
    )
  }
  return <div className="apple-speech-add-row">{content()}</div>
}
