import type { PublicState } from '@/bridge/types/state'
import { useWorkspace } from '@/workspace'
import type { ProviderId } from '../../ai-providers'
import { useSettingsT } from '../../use-settings-t'
import { activeChatGPT } from './connected-sources'
import { KeyButton, ProviderAction, ProviderCard } from './provider-card'

// The Cloud APIs section: ChatGPT signs in with the account; the API providers open their page for a key or endpoint.
export function CloudSources({
  state,
  connected,
  onOpen,
}: {
  state: PublicState
  connected: { chatgpt: boolean; openai: boolean; gemini: boolean; openrouter: boolean; custom: boolean }
  onOpen: (id: ProviderId) => void
}) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const chatgpt = activeChatGPT(state)
  return (
    <div className="api-grid-section">
      <div className="api-grid-section-header">
        <span className="api-grid-section-line" />
        <span className="api-grid-section-label">{st('settings.api.cardGrid.sectionCloud', 'Cloud APIs')}</span>
      </div>
      <div className="provider-grid">
        <ProviderCard
          id="chatgpt"
          on={connected.chatgpt}
          title={st('settings.api.providers.chatgptName', 'ChatGPT Plus')}
          description={st(
            'settings.api.providers.chatgptDescription',
            'Sign in with your ChatGPT Plus or Pro subscription to access advanced OpenAI models without API keys.',
          )}
        >
          {chatgpt ? (
            <ProviderAction
              icon="logout"
              label={st('settings.api.cardGrid.signOutChatGPT', 'Sign Out')}
              onClick={() => void ws.act(() => ws.api.logoutChatGPT(chatgpt.id).then(() => undefined))}
            />
          ) : (
            <ProviderAction
              icon="login"
              label={st('settings.api.cardGrid.signInChatGPT', 'Sign in with ChatGPT')}
              disabled={state.chatgpt.pending}
              onClick={() =>
                void ws.act(async () => {
                  await ws.api.loginChatGPT(undefined)
                  await ws.api.settings({ provider: 'chatgpt', model: '' })
                })
              }
            />
          )}
        </ProviderCard>
        <ProviderCard
          id="openai"
          on={connected.openai}
          title={st('settings.api.providers.openaiApiName', 'OpenAI API')}
          description={st('settings.api.providers.openaiApiDescription', 'Connect OpenAI using your API key.')}
        >
          <KeyButton
            icon="vpn_key"
            label={st('settings.api.cardGrid.configureApiKey', 'Configure API Key')}
            onOpen={() => onOpen('openai')}
          />
        </ProviderCard>
        <ProviderCard
          id="gemini"
          on={connected.gemini}
          title={st('settings.api.providers.geminiName', 'Google Gemini')}
          description={st('settings.api.providers.geminiCardDescription', 'Connect Google Gemini using your API key.')}
        >
          <KeyButton
            icon="vpn_key"
            label={st('settings.api.cardGrid.addApiKey', 'Add API Key')}
            onOpen={() => onOpen('gemini')}
          />
        </ProviderCard>
        <ProviderCard
          id="openrouter"
          on={connected.openrouter}
          title={st('settings.api.providers.openrouterName', 'OpenRouter')}
          description={st(
            'settings.api.providers.openrouterCardDescription',
            'A unified interface to access hundreds of AI models through a single API connection.',
          )}
        >
          <KeyButton
            icon="vpn_key"
            label={st('settings.api.cardGrid.configureOpenRouter', 'Configure OpenRouter')}
            onOpen={() => onOpen('openrouter')}
          />
        </ProviderCard>
        <ProviderCard
          id="custom"
          on={connected.custom}
          title={st('settings.api.providers.customName', 'Custom API')}
          description={st(
            'settings.api.providers.customCardDescription',
            'Connect to any OpenAI-compatible API endpoint. Works with self-hosted models, vLLM, LocalAI, and more.',
          )}
        >
          <KeyButton
            icon="api"
            label={st('settings.api.cardGrid.configureCustomApi', 'Configure Endpoint')}
            onOpen={() => onOpen('custom')}
          />
        </ProviderCard>
      </div>
    </div>
  )
}
