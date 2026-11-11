import { useEffect, useState } from 'react'
import { errorMessage } from '@/format'
import { useWorkspace } from '@/workspace'

type Phase = 'idle' | 'ask' | 'saving' | 'saved' | 'error'

// When a recording ends, the bar asks whether to save the session's
// summary and handoff as a Markdown note, instead of emailing it. Nothing is saved unless the user says so.
export function useSessionNote() {
  const ws = useWorkspace()
  const listening = Boolean(ws.state?.overlay.listening?.active)
  const sessionId = ws.state?.activeSessionId ?? null
  const [phase, setPhase] = useState<Phase>('idle')
  const [target, setTarget] = useState<string | null>(null)
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  // A recording that stops asks once; a new one clears the question.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [seen, setSeen] = useState({ listening, sessionId })
  if (seen.listening !== listening || (listening && seen.sessionId !== sessionId)) {
    setSeen({ listening, sessionId })
    if (seen.listening && !listening && seen.sessionId) {
      setTarget(seen.sessionId)
      setPhase('ask')
    } else if (listening) setPhase('idle')
  }
  // A saved note's confirmation stays long enough to open it, then the assistant pill returns.
  useEffect(() => {
    if (phase !== 'saved') return
    const timer = window.setTimeout(() => setPhase('idle'), 12000)
    return () => window.clearTimeout(timer)
  }, [phase])
  const save = async () => {
    if (!target) return
    setPhase('saving')
    setError('')
    try {
      const result = await ws.api.saveSessionNote({ requestId: crypto.randomUUID(), sessionId: target })
      setPath(result.path)
      setPhase('saved')
    } catch (cause) {
      setError(errorMessage(cause))
      setPhase('error')
    }
  }
  return {
    phase,
    path,
    error,
    save: () => void save(),
    open: () => void ws.act(async () => void (await ws.api.openSessionNote(path))),
    dismiss: () => setPhase('idle'),
  }
}

export type SessionNote = ReturnType<typeof useSessionNote>
