import { SettingsIcon } from '../../settings-icon'
import { useSettingsT } from '../../use-settings-t'

const notice = (backgroundColor: string, border: string, color: string) => ({
  padding: '10px 15px',
  marginBottom: '15px',
  backgroundColor,
  border,
  borderRadius: '6px',
  color,
  fontSize: '12px',
})

// A refused change (keys another shortcut uses) shows as a warning; a save that failed shows as an error.
export function ShortcutWarning({ text }: { text: string }) {
  return (
    <div
      className="shortcut-error glass-panel-medium"
      style={notice('rgba(255, 193, 7, 0.1)', '1px solid rgba(255, 193, 7, 0.3)', 'rgba(255, 193, 7, 0.9)')}
    >
      <SettingsIcon name="warning" style={{ marginRight: '6px' }} />
      {text}
    </div>
  )
}

export function ShortcutError({ text }: { text: string }) {
  return (
    <div
      className="shortcut-error glass-panel-medium"
      style={notice('rgba(220, 53, 69, 0.1)', '1px solid rgba(220, 53, 69, 0.3)', 'rgba(220, 53, 69, 0.9)')}
    >
      {text}
    </div>
  )
}

export function ShortcutTips() {
  const { st } = useSettingsT()
  return (
    <div
      className="info-box glass-panel-medium"
      style={{
        marginTop: '20px',
        padding: '12px 15px',
        backgroundColor: 'rgba(100, 150, 255, 0.05)',
        border: '1px solid rgba(100, 150, 255, 0.2)',
        borderRadius: '6px',
      }}
    >
      <div style={{ display: 'flex', gap: '10px' }}>
        <SettingsIcon name="info" style={{ color: 'rgba(100, 150, 255, 0.8)', fontSize: '18px' }} />
        <div style={{ flex: 1, fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5' }}>
          <strong style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{st('settings.shortcuts.tips.heading')}</strong>
          <ul style={{ marginTop: '6px', marginBottom: 0, paddingLeft: '20px' }}>
            <li>{st('settings.shortcuts.tips.modifierRequired')}</li>
            <li>{st('settings.shortcuts.tips.effectImmediate')}</li>
            <li>{st('settings.shortcuts.tips.noDuplicates')}</li>
            <li>{st('settings.shortcuts.tips.escToCancel')}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
