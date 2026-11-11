import type { Settings } from '@/bridge/types/settings'
import type { CatalogModel } from '../model-catalog'

export type Mode = 'transcription' | 'analysis' | 'translation'
// `note` says why an unavailable card cannot be chosen, when the reason is not the usual usage-tier lock.
export type Card = CatalogModel & { icon: string; unavailable?: boolean; note?: string }
// A group's card selects `provider` with `model`; `selected` tells whether a card is the saved choice.
export type Group = {
  id: string
  title: string
  description: string
  badge: string
  icon: string
  tierHint?: boolean
  models: Card[]
  choose: (model: Card) => Partial<Settings> | null
  selected: (model: Card) => boolean
  local?: (model: Card) => string | null
}
type Values = Record<string, string | number>
export type Translate = (key: string, fallback?: string | Values, values?: Values) => string

// What the Models tab knows about the configured providers and the models each one offers.
export interface ProviderSetup {
  settings: Settings
  signedIn: boolean
  keys: Record<string, boolean>
  // Model ids each account or server reported, by provider; missing while they load.
  available: Record<string, string[]>
  // Why a provider's model list could not load, by provider: a rejected key, for one.
  rejected?: Record<string, string>
  localLlm: { id: string; name: string }[]
  localWhisper: { id: string; name: string }[]
  llmRuntime?: string | null
  whisperRuntime?: string | null
  platform: string
  st: Translate
}

// What a custom base URL points at: Ollama and LM Studio by their usual ports, else a generic endpoint.
export function customServer(base: string): { name: string | null; icon: string; local: boolean } {
  if (base.includes(':11434')) return { name: 'Ollama', icon: 'ollama', local: true }
  if (base.includes(':1234')) return { name: 'LM Studio', icon: 'lmstudio', local: true }
  return { name: null, icon: 'custom', local: false }
}

// OpenAI catalog cards; once the account's model list loads, the ones it lacks are marked unavailable. A refused key
// locks them all, each with the short `refused` note; the group says the full reason.
export function openaiCards(catalog: CatalogModel[], ids: string[] | undefined, refused?: string): Card[] {
  return catalog.map((model) => ({
    ...model,
    icon: 'openai',
    ...(refused
      ? { unavailable: true, note: refused }
      : ids && ids.length
        ? { unavailable: !ids.includes(model.id) }
        : {}),
  }))
}

// An OpenAI group's description: why its key was refused, loading, how many models the usage tier locks, or the usual text.
// The short note on each OpenAI card while OpenAI refuses the saved key, or nothing.
export function refusedNote(setup: ProviderSetup) {
  return setup.rejected?.openai
    ? setup.st('settings.models.keyRefused', 'Unavailable until OpenAI accepts the API key.')
    : undefined
}

export function openaiDescription(setup: ProviderSetup, locked: number, usual: { key: string; fallback: string }) {
  const { st, available, rejected } = setup
  if (rejected?.openai) return rejected.openai
  if (!available.openai) return st('settings.models.loadingModels', 'Loading available models...')
  if (locked > 0) return st('settings.models.unavailableCount', { count: locked })
  return st(usual.key, usual.fallback)
}
