import { Eye, EyeOff } from 'lucide-react'
import { useT } from '@/use-t'
import { saveWithFeedback } from '@/features/workspace/settings-save-feedback'
import './key-field.css'
import { useState } from 'react'
import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import { MASK, blurOnEnter } from './key-input'
import { providerKeyUrl } from '@/features/provider-key-url'

// A provider's API key: shown masked once saved, replaced by typing a new one, with the page to get one.
export function KeyField({ provider, placeholder, note }: { provider: string; placeholder: string; note: string }) {
  const ws = useWorkspace()
  const { t } = useT()
  const [visible, setVisible] = useState(false)
  const { st } = useSettingsT()
  const saved = Boolean(ws.state?.credentials[provider])
  const [value, setValue] = useState(saved ? MASK : '')
  // Saving or removing the key elsewhere resets the field, in the same render.
  const [wasSaved, setWasSaved] = useState(saved)
  if (wasSaved !== saved) {
    setWasSaved(saved)
    setValue(saved ? MASK : '')
  }
  const url = providerKeyUrl(provider)
  return (
    <>
      <label htmlFor={`${provider}-api-key`}>{st('settings.api.apiKeyLabel', 'API Key')}</label>
      <div
        className="input-with-icon provider-key-input"
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return
          setVisible(false)
          if (value === MASK || (!value && !saved)) return
          void ws.act(async () => {
            await saveWithFeedback(() => ws.api.saveKey({ provider, key: value.trim() }))
          })
        }}
      >
        <input
          id={`${provider}-api-key`}
          type={visible && value !== MASK ? 'text' : 'password'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => value === MASK && event.currentTarget.select()}
          onKeyDown={blurOnEnter}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="button"
          data-key-visibility
          className="key-visibility"
          disabled={!value || value === MASK}
          aria-label={t(visible ? 'settingsPage.hideKey' : 'settingsPage.showKey')}
          aria-pressed={visible}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
        {url ? (
          <button
            type="button"
            aria-label={t('settingsPage.getKey')}
            className="link-icon"
            onClick={() => void ws.api.openResponseLink(url)}
          >
            <SettingsIcon name="open_in_new" />
          </button>
        ) : null}
      </div>
      <p className="setting-description">{note}</p>
    </>
  )
}
