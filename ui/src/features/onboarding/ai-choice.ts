import type { CatalogModel, LocalState } from '@/bridge/types/local-models'

export type AiChoice = 'chatgpt' | 'key' | 'local'
export type KeyProvider = 'openai' | 'gemini' | 'openrouter'

export const KEY_PROVIDERS: KeyProvider[] = ['openai', 'gemini', 'openrouter']

// The card a saved provider belongs to; a custom endpoint belongs to none, since only Settings configures it.
export function providerChoice(provider: string): AiChoice | null {
  if (provider === 'chatgpt') return 'chatgpt'
  if (provider === 'local') return 'local'
  if ((KEY_PROVIDERS as string[]).includes(provider)) return 'key'
  return null
}

export function initialAiChoice(provider: string): AiChoice {
  return providerChoice(provider) ?? 'chatgpt'
}

// A new connection answers with the first model the account offers in the app's catalog order, so the choice
// matches what the Models tab recommends; an account outside the catalog falls back to the first model it lists.
export function firstModel(offered: string[], preferred: string[]): string {
  return preferred.find((id) => offered.includes(id)) ?? offered[0] ?? ''
}

// The local model the onboarding downloads: the catalog's recommended language model, else its first current one.
export function recommendedLocalModel(catalog: CatalogModel[]): CatalogModel | undefined {
  const current = catalog.filter((model) => model.kind === 'llm' && !model.legacy)
  return current.find((model) => model.recommended) ?? current[0]
}

// A vision model downloads its projector too, so the size shown before downloading counts both files.
export function downloadBytes(model: CatalogModel): number {
  return (model.bytes ?? 0) + (model.projector?.bytes ?? 0)
}

export function availableLocalModel(local: Pick<LocalState, 'models'>) {
  return local.models.find((model) => model.kind === 'llm' && model.available)
}

// Whole percent of the running language-model download or runtime install; null while the size is unknown.
export function localProgress(local: Pick<LocalState, 'operations'>): number | null {
  const operation = (local.operations ?? []).find((item) => item.kind === 'llm')
  if (!operation?.total) return null
  return Math.min(100, Math.floor((operation.bytes / operation.total) * 100))
}

export function sizeLabel(bytes: number): string {
  const gb = bytes / 1e9
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${Math.round(bytes / 1e6)} MB`
}
