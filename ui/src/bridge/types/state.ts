import type { Assistant } from './assistants'
import type { ChatGptAccount } from './integrations'
import type { CatalogModel, LocalState } from './local-models'
import type { SessionSummary } from './sessions'
import type { PrivacyState, Settings, ShortcutDefinition } from './settings'
import type { Unsubscribe } from './subscription'

export interface PublicState {
  notch: {
    expanded: boolean
    visible: boolean
    pendingAutomatic: boolean
    lastDisplayedAt: number | null
    bounds: { x: number; y: number; width: number; height: number } | null
    pinned: boolean
  }
  overlay: {
    expanded: boolean
    listening?: { active: boolean; starting?: boolean; paused?: boolean; since: number | null }
    // The recording bar's prompt and live transcript rows, shown while the session panel is collapsed.
    barRows?: { prompt: boolean; preview: boolean; guide: boolean }
  }
  shortcutDefinitions: ShortcutDefinition[]
  settings: Settings
  credentials: Record<string, boolean>
  customHeaderNames: string[]
  assistants: Assistant[]
  // The catalog the onboarding chooses from, including built-ins the user deleted.
  builtInAssistants: { id: string; name: string; category: string }[]
  sessions: SessionSummary[]
  activeSessionId: string | null
  localModels: LocalState
  runtimeInstalls: { kind: string; progress: string }[]
  modelCatalog: CatalogModel[]
  chatgpt: { accounts: ChatGptAccount[]; activeId: string | null; pending: boolean }
  privacy: PrivacyState
  permissions: { microphone: string; screen: string; accessibility?: boolean }
}

export interface StateApi {
  state: () => Promise<PublicState>
  onChange: (listener: (value: PublicState) => void) => Unsubscribe
}
