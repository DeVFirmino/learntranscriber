import type { WorkspaceApi } from '@/bridge/types/api'
import type { CatalogModel, LocalState } from '@/bridge/types/local-models'
import { GEMINI_ANALYSIS, OPENAI_ANALYSIS } from '../../settings/model-catalog'
import { availableLocalModel, firstModel, recommendedLocalModel, type KeyProvider } from './ai-choice'

type ConnectApi = Pick<
  WorkspaceApi,
  'loginChatGPT' | 'models' | 'settings' | 'saveKey' | 'installRuntime' | 'downloadCatalog'
>

const OPENAI_ORDER = OPENAI_ANALYSIS.map((model) => model.id)
const PREFERRED: Record<KeyProvider, string[]> = {
  openai: OPENAI_ORDER,
  gemini: GEMINI_ANALYSIS.map((model) => model.id),
  openrouter: OPENAI_ORDER.map((id) => `openai/${id}`),
}

async function chooseFirstModel(api: ConnectApi, provider: string, preferred: string[]) {
  const model = firstModel(await api.models(provider), preferred)
  if (!model) throw new Error('This account offers no models to answer with.')
  await api.settings({ provider, model })
}

// Signs in only when no ChatGPT account is active; listing the account's models is what proves the sign-in works.
export async function connectChatGPT(api: ConnectApi, signedIn: boolean) {
  if (!signedIn) await api.loginChatGPT(undefined)
  await chooseFirstModel(api, 'chatgpt', OPENAI_ORDER)
}

// Listing the provider's models right after saving checks the key before the step moves on.
export async function connectKey(api: ConnectApi, provider: KeyProvider, key: string) {
  await api.saveKey({ provider, key: key.trim() })
  await chooseFirstModel(api, provider, PREFERRED[provider])
}

// Installs the runtime and downloads the recommended model only when this Mac lacks them. The local server starts on
// the first answer, so nothing keeps running for a person who never listens.
export async function connectLocal(api: ConnectApi, local: LocalState, catalog: CatalogModel[]) {
  let current = local
  if (!current.binaries.llm) current = await api.installRuntime('llm')
  let model = availableLocalModel(current)
  if (!model) {
    const entry = recommendedLocalModel(catalog)
    if (!entry) throw new Error('No local model is available to download.')
    current = await api.downloadCatalog(entry.id)
    model = availableLocalModel(current)
  }
  if (!model) throw new Error('The local model did not finish downloading.')
  await api.settings({ provider: 'local', model: model.id })
}
