import type { PublicState } from '@/bridge/types/state'

export type ModelSetup = 'ready' | 'connect' | 'model' | 'provider' | 'local'

// Account access and model selection are separate steps; another connected provider never grants access to this one.
export function modelSetup(state: PublicState): ModelSetup {
  const { settings, chatgpt, credentials, localModels } = state
  let connected = false
  if (settings.provider === 'local') {
    connected = Boolean(localModels.binaries.llm) && localModels.models.some((m) => m.kind === 'llm' && m.available)
    if (!connected) return 'local'
  } else if (settings.provider === 'chatgpt') {
    connected = chatgpt.accounts.some((a) => a.id === chatgpt.activeId && a.authenticated)
  } else if (settings.provider === 'custom') connected = Boolean(settings.customBaseUrl.trim())
  else connected = Boolean(credentials[settings.provider])
  if (connected) return settings.model.trim() ? 'ready' : 'model'
  const otherConnection =
    chatgpt.accounts.some((a) => a.authenticated) ||
    Object.values(credentials).some(Boolean) ||
    Boolean(settings.customBaseUrl.trim())
  return otherConnection ? 'provider' : 'connect'
}

export const MODEL_NOT_READY = 'Connect an AI provider and choose a model in AI & models first.'

export function modelReady(state: PublicState | null | undefined): boolean {
  return Boolean(state && modelSetup(state) === 'ready')
}

export function requireModelReady(state: PublicState | null | undefined): void {
  if (!modelReady(state)) throw new Error(MODEL_NOT_READY)
}
