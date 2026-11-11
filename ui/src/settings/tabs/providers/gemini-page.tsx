import { useSettingsT } from '../../use-settings-t'
import { KeyField } from './key-field'

export function GeminiPage() {
  const { st } = useSettingsT()
  return (
    <>
      <p className="provider-description">{st('settings.api.providers.geminiDescription')}</p>
      <div className="setting-group compact">
        <KeyField
          provider="gemini"
          placeholder={st('settings.api.geminiPlaceholder')}
          note={st('settings.api.geminiApiKeyNote')}
        />
      </div>
    </>
  )
}
