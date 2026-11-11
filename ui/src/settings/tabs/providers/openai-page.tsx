import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../../use-settings-t'
import { ChatGptAuth } from './chatgpt-auth'
import { KeyField } from './key-field'
import { ModelDropdown } from './model-dropdown'
import { useProviderModels } from './use-provider-models'

export function OpenAiPage({ onSetUpLocal }: { onSetUpLocal: () => void }) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const state = ws.state
  const signedIn = Boolean(
    state?.chatgpt.accounts.some((item) => item.id === state.chatgpt.activeId && item.authenticated),
  )
  const models = useProviderModels('chatgpt', signedIn)
  if (!state) return null
  return (
    <>
      <p className="provider-description">{st('settings.api.providers.openaiDescription')}</p>
      <div className="setting-group compact">
        <ChatGptAuth onSetUpLocal={onSetUpLocal} />
        <KeyField
          provider="openai"
          placeholder={st('settings.api.openaiPlaceholder')}
          note={st('settings.api.apiKeySecurityNote')}
        />
      </div>
      {signedIn && models.length ? (
        <div className="setting-group compact">
          <ModelDropdown
            models={models}
            value={state.settings.provider === 'chatgpt' ? state.settings.model : ''}
            onChoose={(model) =>
              void ws.act(async () => {
                await ws.api.settings({ provider: 'chatgpt', model })
              })
            }
          />
        </div>
      ) : null}
    </>
  )
}
