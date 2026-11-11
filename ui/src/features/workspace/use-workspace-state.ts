import { useState } from 'react'
import type { PublicState } from '@/bridge/types/state'
import { errorMessage } from '@/format'
import { useLatest } from './use-latest'
import type { WorkspaceEvents } from './use-workspace-events'

// The main process's public state as this window last received it, and why the first load failed, if it did.
export function useWorkspaceState() {
  const [state, setState] = useState<PublicState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const stateRef = useLatest(state)
  const events: Pick<WorkspaceEvents, 'localChange' | 'runtimeChange' | 'loadFailed'> = {
    localChange: (value) => setState((current) => (current ? { ...current, localModels: value } : current)),
    runtimeChange: (items) => setState((current) => (current ? { ...current, runtimeInstalls: items } : current)),
    loadFailed: (error) => setLoadError(errorMessage(error)),
  }
  return { state, setState, loadError, read: () => stateRef.current, events }
}
