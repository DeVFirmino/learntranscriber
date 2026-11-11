import type { ShortcutDefinition } from '@/bridge/types/settings'
import { shortcutCardState } from '@/features/shortcut-card-state'
import { Toggle } from '../../controls'
import { useSettingsT } from '../../use-settings-t'
import { ShortcutRecorder } from './shortcut-recorder'

// Shortcut editing keeps the keys, Change action and enabled switch together.
export function ShortcutRow({
  item,
  label,
  onRecord,
  onReset,
  onEnabled,
}: {
  item: ShortcutDefinition
  label: string
  onRecord: (accelerator: string) => boolean
  onReset: () => void
  onEnabled: (enabled: boolean) => void
}) {
  const { st } = useSettingsT()
  const { custom, canReset, state } = shortcutCardState(item)
  return (
    <div className="shortcut-card" data-state={state}>
      <div className="shortcut-card-info">
        <div className="shortcut-card-head">
          <span className="shortcut-card-title glass-text-primary">{label}</span>
          {custom ? (
            <span className="shortcut-badge shortcut-badge-custom">{st('settings.shortcuts.customBadge')}</span>
          ) : null}
          {!item.enabled ? (
            <span className="shortcut-badge shortcut-badge-off">{st('settings.shortcuts.disabledBadge')}</span>
          ) : null}
        </div>
        <p className="shortcut-card-description" title={st(`settings.shortcuts.descriptions.${item.reference}`)}>
          {st(`settings.shortcuts.descriptions.${item.reference}`)}
        </p>
      </div>
      <div className="shortcut-card-keys">
        <ShortcutRecorder name={label} value={item.accelerator} disabled={!item.enabled} onRecord={onRecord} />
        {canReset ? (
          <button onClick={onReset} className="glass-button-small shortcut-card-reset">
            {st('settings.shortcuts.reset')}
          </button>
        ) : null}
        <Toggle
          checked={item.enabled}
          ariaLabel={`${label} ${st('settings.shortcuts.enabled')}`}
          onChange={onEnabled}
        />
      </div>
    </div>
  )
}
// keys: settings.shortcuts.descriptions.execute settings.shortcuts.descriptions.screenshot settings.shortcuts.descriptions.whisper
// keys: settings.shortcuts.descriptions.toggleMicCapture settings.shortcuts.descriptions.scrollUp settings.shortcuts.descriptions.scrollDown
// keys: settings.shortcuts.descriptions.notchHistoryPrev settings.shortcuts.descriptions.notchHistoryNext settings.shortcuts.descriptions.anchorPrev
// keys: settings.shortcuts.descriptions.anchorNext settings.shortcuts.descriptions.toggleVisibility settings.shortcuts.descriptions.toggleActionBar
// keys: settings.shortcuts.descriptions.toggleAlwaysOnTop settings.shortcuts.descriptions.increaseAppOpacity settings.shortcuts.descriptions.decreaseAppOpacity
// keys: settings.shortcuts.descriptions.moveWindowLeft settings.shortcuts.descriptions.moveWindowRight settings.shortcuts.descriptions.moveWindowUp
// keys: settings.shortcuts.descriptions.moveWindowDown
