// The browser preview of the native bridge: the same WorkspaceApi, built from one mock per feature over shared local
// fixtures. Nothing here reaches the network, the file system or a model.
import type { WorkspaceApi } from './types/api'
import { createMockContext } from './mock/state'
import { appApi } from './mock/app'
import { assistantsApi } from './mock/assistants'
import { audioApi } from './mock/audio'
import { contextApi } from './mock/context'
import { generationApi } from './mock/generation'
import { integrationsApi } from './mock/integrations'
import { localModelsApi } from './mock/local-models'
import { memoryApi } from './mock/memory'
import { sessionNotesApi } from './mock/session-notes'
import { sessionsApi } from './mock/sessions'
import { settingsApi } from './mock/settings'
import { updatesApi } from './mock/updates'
import { windowsApi } from './mock/windows'

export function createMockWorkspace(): WorkspaceApi {
  const ctx = createMockContext()
  const assistants = assistantsApi(ctx)
  const sessions = sessionsApi(ctx)
  return {
    ...appApi(ctx),
    ...assistants,
    ...audioApi(ctx),
    ...contextApi(ctx),
    ...generationApi(ctx),
    ...integrationsApi(ctx),
    ...localModelsApi(ctx),
    ...memoryApi(ctx),
    ...sessions,
    ...sessionNotesApi(ctx),
    ...settingsApi(ctx),
    ...updatesApi(ctx),
    ...windowsApi(ctx),
  }
}
