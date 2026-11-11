import type { Unsubscribe } from './subscription'

export interface ChatGptAccount {
  id: string
  label: string
  authenticated: boolean
}

export interface IntegrationsApi {
  loginChatGPT: (id?: string) => Promise<unknown>
  cancelChatGPT: () => Promise<unknown>
  selectChatGPT: (id: string) => Promise<unknown>
  logoutChatGPT: (id: string) => Promise<{ revoked: boolean; state?: unknown }>
  onIntegrationError: (listener: (message: string) => void) => Unsubscribe
  // Writes an error the user saw to main.log; forward also shows it in the other windows.
  reportError: (input: { message: string; forward: boolean }) => Promise<boolean>
}
