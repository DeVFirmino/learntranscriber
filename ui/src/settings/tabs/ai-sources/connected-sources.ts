import type { PublicState } from '../../../bridge/types/state'

// Which AI sources count as connected: downloaded local models, a custom endpoint on the Ollama or LM Studio port,
// Apple Speech authorized, a signed-in ChatGPT account, a saved key, or a complete custom endpoint.
export function connectedSources(state: PublicState, speechAuthorized: boolean) {
  const settings = state.settings
  const base = settings.customBaseUrl || ''
  const chatgpt = activeChatGPT(state)
  return {
    local: state.localModels.models.length > 0,
    ollama: base.includes(':11434'),
    lmstudio: base.includes(':1234'),
    apple_speech: speechAuthorized,
    chatgpt: Boolean(chatgpt),
    openai: Boolean(state.credentials.openai),
    gemini: Boolean(state.credentials.gemini),
    openrouter: Boolean(state.credentials.openrouter),
    custom: Boolean(base.trim() && settings.model && settings.provider === 'custom'),
  }
}

// The signed-in ChatGPT account the app uses, if any.
export function activeChatGPT(state: PublicState) {
  return state.chatgpt.accounts.find((account) => account.id === state.chatgpt.activeId && account.authenticated)
}
