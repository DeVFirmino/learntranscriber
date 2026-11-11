import { useMemo, useState } from 'react'
import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import { onActivationKey } from '@/features/keyboard-activation'
import { KeyField } from './key-field'
import { useProviderModels } from './use-provider-models'

export function OpenRouterPage() {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const hasKey = Boolean(ws.state?.credentials.openrouter)
  const models = useProviderModels('openrouter', hasKey)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const settings = ws.state?.settings
  const current = settings?.provider === 'openrouter' ? settings.model : ''
  const filtered = useMemo(
    () => models.filter((id) => id.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 200),
    [models, query],
  )
  if (!settings) return null
  const chooseModel = (id: string) => {
    setQuery('')
    setOpen(false)
    void ws.act(async () => {
      await ws.api.settings({ provider: 'openrouter', model: id })
    })
  }
  return (
    <>
      <p className="provider-description">{st('settings.api.providers.openrouterDescription')}</p>
      <div className="setting-group compact">
        <KeyField
          provider="openrouter"
          placeholder={st('settings.api.openrouterPlaceholder')}
          note={st('settings.api.openrouterApiKeyNote')}
        />
        <div className="whisper-note glass-panel-info">
          <SettingsIcon name="info" />
          <p>{st('settings.api.openrouterWhisperNote')}</p>
        </div>
      </div>
      {hasKey ? (
        <div className="setting-group compact">
          <div className="model-selection">
            <label htmlFor="openrouter-model-search">{st('settings.api.modelLabel', 'Model')}</label>
            <div className="audio-device-selector-container">
              <div className="model-search-input-wrapper">
                <SettingsIcon name="search" className="search-icon" />
                <input
                  id="openrouter-model-search"
                  type="text"
                  className="custom-input model-search-input"
                  placeholder={st('settings.api.searchModels', 'Search models...')}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setOpen(true)
                  }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Escape') return
                    setOpen(false)
                    event.currentTarget.blur()
                  }}
                />
                {current && !query ? <span className="current-model-badge">{current}</span> : null}
              </div>
              {open && filtered.length ? (
                <div
                  role="listbox"
                  aria-label={st('settings.api.modelLabel', 'Model')}
                  className="audio-device-dropdown-settings"
                  onMouseLeave={() => setOpen(false)}
                >
                  {filtered.map((id) => (
                    <div
                      key={id}
                      role="option"
                      aria-selected={current === id}
                      tabIndex={0}
                      className={`audio-device-option ${current === id ? 'selected' : ''}`}
                      onClick={() => chooseModel(id)}
                      onKeyDown={onActivationKey(() => chooseModel(id))}
                    >
                      <SettingsIcon name="smart_toy" className="option-icon" />
                      <span className="option-label">{id}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {open && query && !filtered.length ? (
                <div className="audio-device-dropdown-settings no-results">
                  <div className="no-results-message">{st('settings.api.noModelsFound', 'No models found')}</div>
                </div>
              ) : null}
            </div>
            {!current ? (
              <div className="model-warning inline">
                <SettingsIcon name="warning" />
                {st('settings.api.pleaseSelectModel')}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
