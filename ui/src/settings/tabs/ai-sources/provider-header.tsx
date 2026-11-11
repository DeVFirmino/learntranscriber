import { ProviderIcon } from '../../settings-icon'
import { useSettingsT } from '../../use-settings-t'
import './provider-page.css'

// The top of a provider's page, matching its card in the grid: the logo tile, the name and the Connected badge.
export function ProviderHeader({ id, name, connected }: { id: string; name: string; connected: boolean }) {
  const { st } = useSettingsT()
  return (
    <header className="provider-header">
      <div className="api-grid-card-icon">
        <ProviderIcon providerId={id} />
      </div>
      <h2 className="provider-header-name">{name}</h2>
      <span className={`api-grid-card-badge ${connected ? 'connected' : ''}`}>
        <span className="api-grid-card-badge-dot" />
        {connected
          ? st('settings.api.cardGrid.connected', 'Connected')
          : st('settings.api.cardGrid.notConnected', 'Not Connected')}
      </span>
    </header>
  )
}
