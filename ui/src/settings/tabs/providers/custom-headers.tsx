import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import { MASK } from './key-input'

export type HeaderRow = { key: string; value: string; saved?: string }

// Extra headers sent to a custom server; a saved value shows as a mask and stays stored until replaced.
export function CustomHeaders({
  headers,
  onHeaders,
  onSave,
}: {
  headers: HeaderRow[]
  onHeaders: (rows: HeaderRow[]) => void
  onSave: (rows: HeaderRow[]) => void
}) {
  const { st } = useSettingsT()
  return (
    <div className="model-selection" style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label>{st('settings.api.customHeadersOptional')}</label>
        <button
          className="glass-button-small"
          onClick={() => onHeaders([...headers, { key: '', value: '' }])}
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          <SettingsIcon name="add" style={{ fontSize: '16px' }} />
          {st('settings.api.addHeader')}
        </button>
      </div>
      <p className="setting-description" style={{ marginBottom: '12px', fontSize: '12px', opacity: 0.8 }}>
        {st('settings.api.addCustomHeaders')}
      </p>
      {headers.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {headers.map((row, index) => (
            <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="custom-input"
                value={row.key}
                onChange={(event) =>
                  onHeaders(headers.map((item, at) => (at === index ? { ...item, key: event.target.value } : item)))
                }
                onBlur={() => onSave(headers)}
                placeholder={st('settings.api.headerNamePlaceholder')}
                style={{ flex: '1' }}
              />
              <input
                type="text"
                className="custom-input"
                value={row.value}
                onChange={(event) =>
                  onHeaders(headers.map((item, at) => (at === index ? { ...item, value: event.target.value } : item)))
                }
                onBlur={() => onSave(headers)}
                placeholder={row.saved ? MASK : st('settings.api.headerValuePlaceholder')}
                style={{ flex: '1' }}
              />
              <button
                className="glass-button-small"
                onClick={() => onSave(headers.filter((_, at) => at !== index))}
                style={{ padding: '6px', minWidth: 'auto' }}
              >
                <SettingsIcon name="delete" style={{ fontSize: '18px' }} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
