import { useState } from 'react'
import type { DiscoveredServer } from '@/bridge/types/local-models'
import type { Settings } from '@/bridge/types/settings'
import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'

// Finds OpenAI-compatible servers on this Mac: the connected one, a scan, and each server found with its first
// models to connect to. A server that lists no models opens the manual setup instead.
export function ServerDiscovery({
  settings,
  connected,
  connectedModel,
  save,
  onManual,
}: {
  settings: Settings
  connected: boolean
  connectedModel: string
  save: (patch: Partial<Settings>) => void
  onManual: () => void
}) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const [servers, setServers] = useState<DiscoveredServer[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const scan = () =>
    void (async () => {
      setScanning(true)
      setServers(null)
      try {
        setServers((await ws.api.discoverLocalServers()).filter((server) => server.available))
      } catch {
        setServers([])
      } finally {
        setScanning(false)
      }
    })()
  return (
    <>
      {connected ? (
        <div className="custom-api-connected">
          <div className="custom-api-connected-info">
            <span className="custom-api-connected-dot" />
            <span className="custom-api-connected-model">{connectedModel}</span>
            <span className="custom-api-connected-url">{settings.customBaseUrl}</span>
          </div>
          <button className="glass-button-small detect-btn" onClick={scan} disabled={scanning}>
            <SettingsIcon name="swap_horiz" style={{ fontSize: '15px', pointerEvents: 'none' }} />
            <span>{st('settings.api.changeServer')}</span>
          </button>
        </div>
      ) : null}
      {!(servers && servers.length) && !connected ? (
        <div className="detect-onboarding-card">
          <div className="detect-onboarding-icon">
            <SettingsIcon name="wifi_tethering" />
          </div>
          <div className="detect-onboarding-content">
            <div className="detect-onboarding-title">{st('settings.api.detectLocalServers')}</div>
            <div className="detect-onboarding-description">{st('settings.api.detectDescription')}</div>
          </div>
          <button className="detect-scan-btn" onClick={scan} disabled={scanning}>
            {scanning ? (
              <>
                <span className="detect-spinner" />
                <span>{st('settings.api.scanning')}</span>
              </>
            ) : (
              <>
                <SettingsIcon name="search" style={{ pointerEvents: 'none' }} />
                <span>{st('settings.api.scanForServers')}</span>
              </>
            )}
          </button>
        </div>
      ) : null}
      {servers && !servers.length && !scanning ? (
        <div className="detect-empty">
          <SettingsIcon name="info" />
          <span>{st('settings.api.noServersDetected')}</span>
        </div>
      ) : null}
      {servers && servers.length ? (
        <div className="detect-results">
          {servers.map((server) => (
            <div className="detect-server-card" key={server.endpoint}>
              <div className="detect-server-card-icon">
                <SettingsIcon name="dns" />
              </div>
              <div className="detect-server-info">
                <div className="detect-server-name">
                  <span>{server.name}</span>
                </div>
                <div className="detect-server-url">{server.endpoint}</div>
                {server.models.length ? (
                  <div className="detect-server-models">
                    {server.models.slice(0, 5).map((id) => (
                      <button
                        key={id}
                        className="detect-model-chip"
                        onClick={() => {
                          setServers(null)
                          save({ provider: 'custom', customBaseUrl: server.endpoint, model: id })
                        }}
                      >
                        {id}
                      </button>
                    ))}
                    {server.models.length > 5 ? (
                      <span className="detect-model-more">
                        {st('settings.api.moreModels', { count: server.models.length - 5 })}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {!server.models.length ? (
                <button
                  className="glass-button-small"
                  style={{ flexShrink: 0 }}
                  onClick={() => {
                    setServers(null)
                    onManual()
                    save({ customBaseUrl: server.endpoint })
                  }}
                >
                  <span>{st('settings.api.useServer')}</span>
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}
