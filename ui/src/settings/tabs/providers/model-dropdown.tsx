import { useState } from 'react'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import { onActivationKey } from '@/features/keyboard-activation'

// A model dropdown, used for the ChatGPT analyze model.
export function ModelDropdown({
  models,
  value,
  onChoose,
}: {
  models: string[]
  value: string
  onChoose: (id: string) => void
}) {
  const { st } = useSettingsT()
  const [open, setOpen] = useState(false)
  const choose = (id: string) => {
    onChoose(id)
    setOpen(false)
  }
  return (
    <div className="model-selection">
      <label htmlFor="codex-model-select">{st('settings.api.analyzeModelLabel', 'Analyze Model')}</label>
      <div className="audio-device-selector-container">
        <button
          id="codex-model-select"
          type="button"
          className="audio-device-selector-button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <SettingsIcon name="smart_toy" className="selector-icon" />
          <span className="selector-label">{value || st('settings.api.selectModel', 'Select a model...')}</span>
          <SettingsIcon name={open ? 'expand_less' : 'expand_more'} className="selector-arrow" />
        </button>
        {open ? (
          <div
            role="listbox"
            aria-label={st('settings.api.analyzeModelLabel', 'Analyze Model')}
            className="audio-device-dropdown-settings"
            onMouseLeave={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
            }}
          >
            {models.map((id) => (
              <div
                key={id}
                role="option"
                aria-selected={value === id}
                tabIndex={0}
                className={`audio-device-option ${value === id ? 'selected' : ''}`}
                onClick={() => choose(id)}
                onKeyDown={onActivationKey(() => choose(id))}
              >
                <SettingsIcon name="smart_toy" className="option-icon" />
                <div className="option-content">
                  <span className="option-label">{id}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <p className="setting-description" style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}>
        {st('settings.api.analyzeModelDescription', 'Model used for analyzing images and conversations')}
      </p>
    </div>
  )
}
