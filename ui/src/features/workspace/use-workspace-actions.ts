import { useState } from 'react'
import type { WorkspaceActions } from '@/workspace'

type Shared = 'mode' | 'api' | 'act' | 'openAiSources' | 'go' | 'search'

// The actions every consumer gets, created once: each reaches the current state through refs or the controllers, so
// a consumer keeps the same functions across renders and the contexts change only when their data does.
export function useWorkspaceActions({
  bridge,
  errors,
  go,
  setQuery,
  ...features
}: {
  bridge: Pick<WorkspaceActions, 'mode' | 'api'>
  errors: Pick<WorkspaceActions, 'act' | 'openAiSources'>
  go: (route: string) => void
  setQuery: (query: string) => void
} & Omit<WorkspaceActions, Shared>) {
  const [actions] = useState<WorkspaceActions>(() => ({
    mode: bridge.mode,
    api: bridge.api,
    ...features,
    go,
    search: async (next) => {
      setQuery(next)
    },
    act: errors.act,
    openAiSources: errors.openAiSources,
  }))
  return actions
}
