import { useState } from 'react'
import type { WorkspaceApi } from '@/bridge/types/api'
import type { SessionDetail } from '@/bridge/types/sessions'
import type { PublicState } from '@/bridge/types/state'
import { documentT } from '@/i18n'
import { SessionController } from './session-controller'
import { useLatest } from './use-latest'

// The session the workspace shows, and opening, refreshing or starting one.
export function useWorkspaceSessions(
  api: WorkspaceApi,
  hooks: { state: () => PublicState | null; setState: (state: PublicState) => void; clearImages: () => void },
) {
  const [session, setSession] = useState<SessionDetail | null>(null)
  const sessionRef = useLatest(session)
  const [sessions] = useState(
    () =>
      new SessionController(api, {
        ...hooks,
        show: setSession,
        navigate: () => {
          window.location.hash = 'session'
        },
      }),
  )
  const title = () =>
    documentT('session.defaultTitle', {
      date: new Date().toLocaleDateString(document.documentElement.lang || undefined),
    })
  const actions = {
    refreshSession: () => sessions.refresh(),
    openSession: (id: string) => sessions.open(id),
    ensureSession: () => sessions.ensure(title),
    startFloatingSession: async () => {
      await sessions.ensure(title, false)
      await api.showOverlay(true)
    },
  }
  return { session, sessionRef, sessions, actions }
}
