import { useState } from 'react'
import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import { KeyField } from './key-field'
import { blurOnEnter } from './key-input'
import { CustomHeaders, type HeaderRow } from './custom-headers'
import { ServerDiscovery } from './server-discovery'

export function CustomPage() {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const settings = ws.state?.settings
  const names = ws.state?.customHeaderNames
  const [manual, setManual] = useState(false)
  const [base, setBase] = useState(settings?.customBaseUrl || '')
  const [model, setModel] = useState(settings?.provider === 'custom' ? settings.model : '')
  const [headers, setHeaders] = useState<HeaderRow[]>(() =>
    (names || []).map((name) => ({ key: name, value: '', saved: name })),
  )
  // Saved settings that change elsewhere replace the fields, in the same render.
  const savedBase = settings?.customBaseUrl || ''
  const savedModel = settings?.provider === 'custom' ? settings.model : ''
  const [fieldsFor, setFieldsFor] = useState({ base: savedBase, model: savedModel })
  if (fieldsFor.base !== savedBase || fieldsFor.model !== savedModel) {
    if (fieldsFor.base !== savedBase) setBase(savedBase)
    if (fieldsFor.model !== savedModel) setModel(savedModel)
    setFieldsFor({ base: savedBase, model: savedModel })
  }
  if (!settings) return null
  const connectedModel = settings.provider === 'custom' ? settings.model : ''
  const connected = Boolean(settings.customBaseUrl && connectedModel)
  const save = (patch: Parameters<typeof ws.api.settings>[0]) =>
    void ws.act(async () => {
      await ws.api.settings(patch)
    })
  const saveHeaders = (rows: HeaderRow[]) => {
    setHeaders(rows)
    void ws.act(async () => {
      // A blank value on an unchanged saved name keeps the stored secret.
      const saved = await ws.api.saveCustomHeaders(
        rows
          .filter((row) => row.key.trim() || row.value)
          .map((row) => ({
            key: row.key.trim(),
            value:
              !row.value && row.saved && row.saved.toLowerCase() === row.key.trim().toLowerCase() ? null : row.value,
          })),
      )
      setHeaders(saved.map((name) => ({ key: name, value: '', saved: name })))
    })
  }
  return (
    <>
      <p className="provider-description">{st('settings.api.providers.customDescription')}</p>
      <div className="setting-group compact">
        <KeyField
          provider="custom"
          placeholder={st('settings.api.customApiPlaceholder')}
          note={st('settings.api.customApiKeyNote')}
        />
      </div>
      <div className="setting-group compact">
        <ServerDiscovery
          settings={settings}
          connected={connected}
          connectedModel={connectedModel}
          save={save}
          onManual={() => setManual(true)}
        />
        <button className="custom-api-advanced-toggle" onClick={() => setManual(!manual)}>
          <SettingsIcon name={manual ? 'expand_less' : 'tune'} style={{ pointerEvents: 'none' }} />
          <span>{st(manual ? 'settings.api.hideAdvanced' : 'settings.api.manualSetup')}</span>
        </button>
        {manual ? (
          <div className="custom-api-advanced-fields">
            <div className="model-selection">
              <label htmlFor="custom-base-url-input">{st('settings.api.baseUrl')}</label>
              <input
                id="custom-base-url-input"
                type="text"
                className="custom-input"
                value={base}
                onChange={(event) => setBase(event.target.value)}
                onBlur={() => base !== settings.customBaseUrl && save({ customBaseUrl: base.trim() })}
                onKeyDown={blurOnEnter}
                placeholder={st('settings.api.baseUrlPlaceholder')}
              />
              <p className="setting-description" style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}>
                {st('settings.api.apiEndpointDescription')}
              </p>
            </div>
            <div className="model-selection" style={{ marginTop: '16px' }}>
              <label htmlFor="custom-model-input">{st('settings.api.modelIdentifier')}</label>
              <input
                id="custom-model-input"
                type="text"
                className="custom-input"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                onBlur={() =>
                  model.trim() && model.trim() !== connectedModel && save({ provider: 'custom', model: model.trim() })
                }
                onKeyDown={blurOnEnter}
                placeholder={st('settings.api.modelPlaceholder')}
              />
              <p className="setting-description" style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}>
                {st('settings.api.modelIdentifierDescription')}
              </p>
            </div>
            <CustomHeaders headers={headers} onHeaders={setHeaders} onSave={saveHeaders} />
          </div>
        ) : null}
      </div>
    </>
  )
}
// keys: settings.api.hideAdvanced settings.api.manualSetup
