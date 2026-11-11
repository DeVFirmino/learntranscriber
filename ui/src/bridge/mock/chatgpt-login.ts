import type { MockContext } from './state'
import { wait } from './simulated-delay'

// ChatGPT account sign-in, simulated locally: only one account can be authenticated and active at a time.
export function chatgptLoginApi(ctx: MockContext) {
  const { state, accounts, settings, publicState, emit } = ctx
  return {
    loginChatGPT: async (id?: string) => {
      await wait(300)
      const accountId = id || crypto.randomUUID()
      const existing = accounts.find((account) => account.id === accountId)
      if (existing) existing.authenticated = true
      else accounts.push({ id: accountId, label: 'Preview account', authenticated: true })
      state.activeAccount = accountId
      settings.provider = 'chatgpt'
      settings.model = ''
      emit()
      return { id: accountId }
    },
    cancelChatGPT: async () => true,
    selectChatGPT: async (id: string) => {
      if (!accounts.some((account) => account.id === id && account.authenticated))
        throw new Error('Sign in to that ChatGPT account first.')
      state.activeAccount = id
      if (settings.provider === 'chatgpt') settings.model = ''
      emit()
      return publicState().chatgpt
    },
    logoutChatGPT: async (id: string) => {
      const account = accounts.find((item) => item.id === id)
      if (account) account.authenticated = false
      if (state.activeAccount === id) state.activeAccount = null
      emit()
      return { revoked: false }
    },
  }
}
