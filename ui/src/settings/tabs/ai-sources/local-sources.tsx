import type { ProviderId } from '../../ai-providers'
import { useSettingsT } from '../../use-settings-t'
import { LocalServerScan } from './local-server-scan'
import { ProviderAction, ProviderCard } from './provider-card'
import type { useLocalServerScan } from './use-local-server-scan'

// The Local & On-Device section: local models, Ollama and LM Studio found by a scan, and Apple Speech. The scan
// belongs to the whole tab, so its result stays while the filter changes.
export function LocalSources({
  connected,
  scan,
  onOpen,
}: {
  connected: { local: boolean; ollama: boolean; lmstudio: boolean; apple_speech: boolean }
  scan: ReturnType<typeof useLocalServerScan>
  onOpen: (id: ProviderId) => void
}) {
  const { st } = useSettingsT()
  return (
    <div className="api-grid-section">
      <div className="api-grid-section-header">
        <span className="api-grid-section-line" />
        <span className="api-grid-section-label">{st('settings.api.cardGrid.sectionLocal', 'Local & On-Device')}</span>
      </div>
      <div className="provider-grid">
        <ProviderCard
          id="local"
          on={connected.local}
          title={st('settings.api.providers.localName', 'Local Models')}
          description={st(
            'settings.api.providers.localCardDescription',
            'Download and run AI models natively inside the app. Private, completely offline, and absolutely no API keys required.',
          )}
        >
          <ProviderAction
            icon="download"
            label={st('settings.api.cardGrid.manageModels', 'Manage Downloaded Models')}
            onClick={() => onOpen('local')}
          />
        </ProviderCard>
        <ProviderCard
          id="ollama"
          on={connected.ollama}
          title={st('settings.api.providers.ollamaName', 'Ollama')}
          description={st(
            'settings.api.providers.ollamaDescription',
            'Run powerful AI models locally on your machine. Private, fast, and completely offline with no API keys required.',
          )}
        >
          <LocalServerScan
            name="Ollama"
            url="https://ollama.com/download"
            status={scan.status('Ollama')}
            onScan={() => scan.scanFor('Ollama')}
          />
        </ProviderCard>
        <ProviderCard
          id="lmstudio"
          on={connected.lmstudio}
          title={st('settings.api.providers.lmstudioName', 'LM Studio')}
          description={st(
            'settings.api.providers.lmstudioDescription',
            'Discover, download, and run any compatible local LLM. Start the local server in LM Studio to connect automatically.',
          )}
        >
          <LocalServerScan
            name="LM Studio"
            url="https://lmstudio.ai/download"
            status={scan.status('LM Studio')}
            onScan={() => scan.scanFor('LM Studio')}
          />
        </ProviderCard>
        <ProviderCard
          id="apple_speech"
          on={connected.apple_speech}
          title={st('settings.api.providers.appleSpeechName', 'Apple Speech')}
          description={st(
            'settings.api.providers.appleSpeechCardDescription',
            'Built-in on-device macOS speech recognition. Extremely fast dictation with zero privacy compromises.',
          )}
        >
          <ProviderAction
            icon="settings"
            label={st('settings.api.cardGrid.manageSettings', 'Manage Settings')}
            onClick={() => onOpen('apple_speech')}
          />
        </ProviderCard>
      </div>
    </div>
  )
}
// keys: settings.api.providers.lmstudioName settings.api.providers.lmstudioDescription
