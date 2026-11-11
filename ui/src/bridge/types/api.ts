import type { AppApi } from './app'
import type { AssistantsApi } from './assistants'
import type { AudioApi } from './audio'
import type { ContextApi } from './context'
import type { GenerationApi } from './generation'
import type { IntegrationsApi } from './integrations'
import type { LocalModelsApi } from './local-models'
import type { MemoryApi } from './memory'
import type { SessionNotesApi } from './session-notes'
import type { SessionsApi } from './sessions'
import type { SettingsApi } from './settings'
import type { StateApi } from './state'
import type { UpdatesApi } from './updates'
import type { WindowsApi } from './windows'

// The typed window.workspace contract: one interface per feature, mirrored 1:1 by preload.cjs.
export interface WorkspaceApi
  extends
    AppApi,
    AssistantsApi,
    AudioApi,
    ContextApi,
    GenerationApi,
    IntegrationsApi,
    LocalModelsApi,
    MemoryApi,
    SessionNotesApi,
    SessionsApi,
    SettingsApi,
    StateApi,
    UpdatesApi,
    WindowsApi {}

declare global {
  interface Window {
    workspace?: WorkspaceApi
  }
}
