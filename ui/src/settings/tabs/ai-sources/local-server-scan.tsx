import { useWorkspace } from '@/workspace'
import { SettingsIcon } from '../../settings-icon'
import { ProviderAction } from './provider-card'
import type { SettingsIconName } from '../../icons/glyphs'
import { useSettingsT } from '../../use-settings-t'
import type { ScanStatus, ServerName } from './use-local-server-scan'

const SCAN_ICONS: Record<string, SettingsIconName> = { scanning: 'hourglass_top', found: 'check_circle' }

// The Ollama or LM Studio card's actions: scan for the server, what the scan found, and the download link.
export function LocalServerScan({
  name,
  url,
  status,
  onScan,
}: {
  name: ServerName
  url: string
  status: ScanStatus
  onScan: () => void
}) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const isOllama = name === 'Ollama'
  const label = () => {
    if (status === 'scanning') return st('settings.api.cardGrid.scanning', 'Scanning...')
    if (status === 'found') return st('settings.api.cardGrid.serverFound', 'Server found')
    if (status === 'not_found') return st('settings.api.cardGrid.serverNotFound', 'Server not found')
    return isOllama
      ? st('settings.api.cardGrid.scanOllama', 'Scan for Ollama Server')
      : st('settings.api.cardGrid.scanLmStudio', 'Scan for LM Studio')
  }
  return (
    <>
      <ProviderAction
        icon={(status && SCAN_ICONS[status]) || 'search'}
        label={label()}
        onClick={onScan}
        disabled={status === 'scanning'}
      />
      {status === 'found' ? (
        <span className="api-grid-card-scan-result success">
          <SettingsIcon name="check" />
          {st('settings.api.cardGrid.serverFoundDetail', `${name} server detected and configured`)}
        </span>
      ) : null}
      {status === 'not_found' ? (
        <span className="api-grid-card-scan-result error">
          <SettingsIcon name="error_outline" />
          {st('settings.api.cardGrid.serverNotFoundDetail', 'No server found. Make sure it is running.')}
        </span>
      ) : null}
      <a
        className="api-grid-card-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          event.preventDefault()
          void ws.api.openResponseLink(url)
        }}
      >
        {isOllama
          ? st('settings.api.cardGrid.downloadOllama', 'Download Ollama')
          : st('settings.api.cardGrid.downloadLmStudio', 'Download LM Studio')}
        <SettingsIcon name="open_in_new" />
      </a>
    </>
  )
}
