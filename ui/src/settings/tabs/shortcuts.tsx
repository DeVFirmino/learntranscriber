import { useState } from 'react'
import { errorMessage } from '@/format'
import { useWorkspace } from '@/workspace'
import { SettingsIcon } from '../settings-icon'
import { useSettingsT } from '../use-settings-t'
import { ShortcutError, ShortcutTips, ShortcutWarning } from './shortcuts/shortcut-notices'
import { ShortcutRow } from './shortcuts/shortcut-row'
import { listedShortcuts, shortcutOwner, withOverride, withoutOverride, type Override } from './shortcuts/shortcut-rows'
import './shortcuts/shortcuts-grid.css'

// Shortcuts: every action as a compact block in a grid with its recorder, badges, switch and Reset, then Reset All and
// the tips. Changes save at once.
export function ShortcutsTab() {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const state = ws.state
  if (!state) return null
  const platform = state.privacy.platform
  const definitions = state.shortcutDefinitions
  const overrides: Record<string, Override> = JSON.parse(state.settings.shortcuts || '{}')
  const label = (reference: string) => st(`settings.shortcuts.labels.${reference}`)
  const flash = (setter: (value: string | null) => void, text: string) => {
    setter(text)
    window.setTimeout(() => setter(null), 3000)
  }
  const save = async (next: Record<string, Override>) => {
    try {
      await ws.api.settings({ shortcuts: JSON.stringify(next) })
      return true
    } catch (failure) {
      flash(setError, errorMessage(failure))
      return false
    }
  }
  // Keys another enabled shortcut already presses are refused with a warning that names it.
  const taken = (id: string, accelerator: string) => {
    const other = shortcutOwner(definitions, id, accelerator, platform)
    if (other)
      flash(
        setWarning,
        st('settings.shortcuts.validation.alreadyUsedBy', {
          label: other.reference ? label(other.reference) : other.label,
        }),
      )
    return Boolean(other)
  }
  return (
    <div className="shortcuts-tab-container">
      <div className="setting-group">
        {warning ? <ShortcutWarning text={warning} /> : null}
        {error ? <ShortcutError text={error} /> : null}
        <div className="shortcuts-grid">
          {listedShortcuts(definitions).map((item) => (
            <ShortcutRow
              key={item.id}
              item={item}
              label={label(item.reference as string)}
              onRecord={(accelerator) => {
                if (taken(item.id, accelerator)) return false
                void save(withOverride(overrides, item.id, { accelerator, enabled: item.enabled }))
                return true
              }}
              onReset={() => void save(withoutOverride(overrides, item.id))}
              onEnabled={(enabled) => {
                if (enabled && taken(item.id, item.accelerator)) return
                void save(withOverride(overrides, item.id, { accelerator: item.accelerator, enabled }))
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              if (window.confirm(st('settings.shortcuts.resetAllConfirm'))) void save({})
            }}
            className="glass-button"
            style={{ padding: '8px 16px', fontSize: '12px' }}
          >
            <SettingsIcon name="restore" style={{ fontSize: '16px', marginRight: '6px' }} />
            {st('settings.shortcuts.resetAll')}
          </button>
        </div>
        <ShortcutTips />
      </div>
    </div>
  )
}
// keys: settings.shortcuts.labels.execute settings.shortcuts.labels.screenshot settings.shortcuts.labels.whisper
// keys: settings.shortcuts.labels.toggleMicCapture settings.shortcuts.labels.scrollUp settings.shortcuts.labels.scrollDown
// keys: settings.shortcuts.labels.notchHistoryPrev settings.shortcuts.labels.notchHistoryNext settings.shortcuts.labels.anchorPrev
// keys: settings.shortcuts.labels.anchorNext settings.shortcuts.labels.toggleVisibility settings.shortcuts.labels.toggleActionBar
// keys: settings.shortcuts.labels.toggleAlwaysOnTop settings.shortcuts.labels.increaseAppOpacity settings.shortcuts.labels.decreaseAppOpacity
// keys: settings.shortcuts.labels.moveWindowLeft settings.shortcuts.labels.moveWindowRight settings.shortcuts.labels.moveWindowUp
// keys: settings.shortcuts.labels.moveWindowDown
