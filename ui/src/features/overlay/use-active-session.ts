import { useEffect, useState } from 'react'
import type { SessionDetail } from '@/bridge/types/sessions'
import { useWorkspace } from '@/workspace'

// The live session's saved entries for the floating assistant, reloaded whenever the workspace state changes.
export function useActiveSession() {
  const ws = useWorkspace()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const state = ws.state
  const sessionId = state?.activeSessionId
  // Without an active session nothing is shown, cleared in the same render.
  if (!sessionId && session) setSession(null)
  useEffect(() => {
    let current = true
    if (!sessionId) return
    void ws.api
      .session(sessionId)
      .then((value) => {
        if (current) setSession(value)
      })
      .catch(() => {
        if (current) setSession(null)
      })
    return () => {
      current = false
    }
  }, [ws.api, sessionId, state])
  return session
}
