import { useState } from 'react'
import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import { activeChatGPT } from '../ai-sources/connected-sources'
import { ProviderAction } from '../ai-sources/provider-card'
import '../ai-sources/provider-page.css'

// Signing in with a ChatGPT plan instead of an API key, as one row like the provider cards: the ChatGPT logo, what it
// does, and the sign-in or sign-out button. Signed in, it adds how the two credentials coexist and the local-model hint.
export function ChatGptAuth({ onSetUpLocal }: { onSetUpLocal: () => void }) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const [failed, setFailed] = useState(false)
  const state = ws.state
  if (!state) return null
  const account = activeChatGPT(state)
  const signIn = () =>
    void ws.act(async () => {
      setFailed(false)
      try {
        await ws.api.loginChatGPT(undefined)
      } catch (error) {
        setFailed(true)
        throw error
      }
    })
  return (
    <section className="provider-method">
      <h4 className="provider-method-label">{st('settings.api.authMethod')}</h4>
      <div className={`provider-method-row ${account ? 'connected' : ''}`}>
        <span className="api-grid-card-icon">
          <SettingsIcon name="provider-chatgpt" />
        </span>
        <div className="provider-method-copy">
          <strong>{st('settings.api.providers.chatgptName', 'ChatGPT Plus')}</strong>
          <p>{st(account ? 'settings.api.chatgptConnected' : 'settings.api.chatgptSignInDesc')}</p>
        </div>
        {account ? (
          <ProviderAction
            icon="logout"
            label={st('settings.api.chatgptSignOut')}
            onClick={() => void ws.act(() => ws.api.logoutChatGPT(account.id).then(() => undefined))}
          />
        ) : (
          <ProviderAction
            icon="login"
            label={st(state.chatgpt.pending ? 'settings.api.chatgptSigningIn' : 'settings.api.chatgptSignIn')}
            disabled={state.chatgpt.pending}
            onClick={signIn}
          />
        )}
      </div>
      {failed ? (
        <p className="provider-method-error" role="alert">
          {st('settings.api.chatgptError')}
        </p>
      ) : null}
      {account ? (
        <div className="provider-method-note">
          <SettingsIcon name="info" />
          <div className="provider-method-note-body">
            <span>{st('settings.api.chatgptBothCredentials')}</span>
            <span>{st('onboarding.steps.api.chatgptLocalModelHint')}</span>
            <span>
              <ProviderAction
                icon="download"
                label={st('onboarding.steps.api.chatgptLocalModelButton')}
                onClick={onSetUpLocal}
              />
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
// keys: settings.api.chatgptSignIn settings.api.chatgptSigningIn settings.api.chatgptConnected settings.api.chatgptSignInDesc
