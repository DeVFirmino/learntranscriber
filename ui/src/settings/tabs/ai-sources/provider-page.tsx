import type { ReactNode } from 'react'
import type { ProviderId } from '../../ai-providers'
import { SettingsIcon } from '../../settings-icon'
import { useSettingsT } from '../../use-settings-t'
import { ProviderHeader } from './provider-header'
import { AppleSpeechPage } from '../apple-speech'
import { LocalModelsPage } from '../local-models'
import { CustomPage } from '../providers/custom-page'
import { GeminiPage } from '../providers/gemini-page'
import { OpenAiPage } from '../providers/openai-page'
import { OpenRouterPage } from '../providers/openrouter-page'

// What each provider's page renders; only OpenAI links on to another provider.
const PROVIDER_CONTENT: Record<ProviderId, (onOpen: (id: ProviderId) => void) => ReactNode> = {
  local: () => <LocalModelsPage />,
  apple_speech: () => <AppleSpeechPage />,
  openai: (onOpen) => <OpenAiPage onSetUpLocal={() => onOpen('local')} />,
  gemini: () => <GeminiPage />,
  openrouter: () => <OpenRouterPage />,
  custom: () => <CustomPage />,
}

const PROVIDER_NAMES: Record<ProviderId, [string, string]> = {
  local: ['settings.api.providers.localName', 'Local Models'],
  apple_speech: ['settings.api.providers.appleSpeechName', 'Apple Speech'],
  openai: ['settings.api.providers.openaiName', 'OpenAI'],
  gemini: ['settings.api.providers.geminiName', 'Google Gemini'],
  openrouter: ['settings.api.providers.openrouterName', 'OpenRouter'],
  custom: ['settings.api.providers.customName', 'Custom API'],
}

// One provider's page: the way back to AI Sources, the same logo, name and status as its card, then its settings.
export function ProviderPage({
  id,
  connected,
  onBack,
  onOpen,
}: {
  id: ProviderId
  connected: boolean
  onBack: () => void
  onOpen: (id: ProviderId) => void
}) {
  const { st } = useSettingsT()
  const [key, fallback] = PROVIDER_NAMES[id]
  return (
    <div className="api-tab-container">
      <div className={`provider-content provider-content-${id}`}>
        <div className="api-breadcrumbs api-breadcrumbs-static">
          <div className="api-breadcrumbs-left">
            <button className="api-breadcrumb-link" onClick={onBack}>
              <SettingsIcon name="arrow_back" />
              <span>{st('settings.tabs.api', 'AI Sources')}</span>
            </button>
          </div>
        </div>
        <div className="api-tab-scroll">
          <div className="provider-panel" key={id}>
            <ProviderHeader id={id} name={st(key, fallback)} connected={connected} />
            {PROVIDER_CONTENT[id](onOpen)}
          </div>
        </div>
      </div>
    </div>
  )
}
