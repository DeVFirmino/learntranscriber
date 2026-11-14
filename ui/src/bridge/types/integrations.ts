import type { Unsubscribe } from './subscription'

export interface ChatGptAccount {
  id: string
  label: string
  authenticated: boolean
}

export interface ListeningNotice {
  permission?: 'microphone' | 'screen' | 'speech'
}

export type IntegrationFeedback = string | { message: string; notice: ListeningNotice }

export interface IntegrationsApi {
  loginChatGPT: (id?: string) => Promise<unknown>
  cancelChatGPT: () => Promise<unknown>
  selectChatGPT: (id: string) => Promise<unknown>
  logoutChatGPT: (id: string) => Promise<{ revoked: boolean; state?: unknown }>
  onIntegrationError: (listener: (feedback: IntegrationFeedback) => void) => Unsubscribe
  // Logs feedback; forward transfers its presentation to one visible application surface.
  reportError: (input: { message: string; forward: boolean; notice?: ListeningNotice }) => Promise<boolean>
}
