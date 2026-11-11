import { useEffect, useLayoutEffect, useRef } from 'react'
import type { WorkspaceApi } from '@/bridge/types/api'
import type { LiveCaption } from '@/bridge/types/audio'
import type { LocalState } from '@/bridge/types/local-models'
import type { SelectionValue } from '@/bridge/types/context'
import type { PublicState } from '@/bridge/types/state'

type Parameter<K extends keyof WorkspaceApi> = WorkspaceApi[K] extends (listener: (value: infer V) => void) => unknown
  ? V
  : never

export interface WorkspaceEvents {
  route(): void
  windowRole(): void
  caption(caption: LiveCaption): void
  prepareQuit(): void
  action(action: string): void
  change(state: PublicState): void
  delta(value: Parameter<'onDelta'>): void
  overlayDelta(value: Parameter<'onOverlayDelta'>): void
  overlayAnswer(value: Parameter<'onOverlayAnswer'>): void
  overlayFinished(value: Parameter<'onOverlayFinished'>): void
  localChange(value: LocalState): void
  runtimeChange(items: Parameter<'onRuntimeChange'>): void
  selection(value: SelectionValue): void
  integrationError(message: string): void
  loaded(state: PublicState, alive: () => boolean): Promise<void>
  loadFailed(error: unknown): void
  dispose(): void
}

// Subscribes once per bridge to every main-process event and to navigation, always calling the latest
// handlers. Events that arrive after unmount, and a late initial load, are ignored.
export function useWorkspaceEvents(api: WorkspaceApi, events: WorkspaceEvents) {
  const latest = useRef(events)
  useLayoutEffect(() => {
    latest.current = events
  })
  useEffect(() => {
    let alive = true
    const on = () => latest.current
    const onHash = () => on().route()
    const onPop = () => on().windowRole()
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onPop)
    const unsubs = [
      api.onLiveCaption((caption) => on().caption(caption)),
      api.onPrepareQuit(() => on().prepareQuit()),
      api.onAction((action) => on().action(action)),
      api.onChange((value) => {
        if (alive) on().change(value)
      }),
      api.onDelta((value) => on().delta(value)),
      api.onOverlayDelta((value) => on().overlayDelta(value)),
      api.onOverlayAnswer((value) => on().overlayAnswer(value)),
      api.onOverlayFinished((value) => on().overlayFinished(value)),
      api.onLocalChange((value) => {
        if (alive) on().localChange(value)
      }),
      api.onRuntimeChange((items) => {
        if (alive) on().runtimeChange(items)
      }),
      api.onSelection((value) => on().selection(value)),
      api.onIntegrationError((message) => on().integrationError(message)),
    ]
    void api
      .state()
      .then((value) => (alive ? on().loaded(value, () => alive) : undefined))
      .catch((error: unknown) => {
        if (alive) on().loadFailed(error)
      })
    return () => {
      alive = false
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onPop)
      for (const unsub of unsubs) unsub()
      on().dispose()
    }
  }, [api])
}
