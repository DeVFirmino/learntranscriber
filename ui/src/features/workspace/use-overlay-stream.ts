import { useRef, useState } from 'react'
import type { WorkspaceApi } from '@/bridge/types/api'
import { OverlayArbiter } from '@/overlay-arbiter'
import { initialOverlayStream, nextOverlayStream, type OverlayStream } from './stream-state'
import type { WorkspaceEvents } from './use-workspace-events'

// The answer the overlay windows show as the main window streams it. The arbiter decides whether an event belongs to
// the live session's current answer.
export function useOverlayStream(api: WorkspaceApi, activeSessionId: () => string | null | undefined) {
  const [overlayStream, setOverlayStream] = useState<OverlayStream>(initialOverlayStream)
  const arbiter = useRef(new OverlayArbiter())
  const events: Pick<WorkspaceEvents, 'overlayDelta' | 'overlayAnswer' | 'overlayFinished'> = {
    overlayDelta: (value) => {
      const decision = arbiter.current.decide(
        { kind: 'delta', requestId: value.requestId, sessionId: value.sessionId, sequence: value.sequence },
        activeSessionId(),
      )
      const at = new Date().toISOString()
      setOverlayStream((current) =>
        nextOverlayStream(current, decision, {
          kind: 'delta',
          requestId: value.requestId,
          text: value.delta,
          mode: value.mode,
          at,
          sessionId: value.sessionId || activeSessionId() || undefined,
        }),
      )
    },
    overlayAnswer: (value) => {
      const decision = arbiter.current.decide(
        { kind: 'answer', requestId: value.requestId, sessionId: value.sessionId, sequence: value.sequence },
        activeSessionId(),
      )
      const newId = crypto.randomUUID()
      setOverlayStream((current) =>
        nextOverlayStream(current, decision, {
          kind: 'answer',
          requestId: value.requestId,
          text: value.text,
          mode: value.mode,
          newId,
          sessionId: value.sessionId || activeSessionId() || undefined,
        }),
      )
    },
    overlayFinished: (value) => {
      const decision = arbiter.current.decide(
        { kind: 'finished', requestId: value.requestId, sessionId: value.sessionId, sequence: value.sequence },
        activeSessionId(),
      )
      setOverlayStream((current) =>
        nextOverlayStream(current, decision, {
          kind: 'finished',
          requestId: value.requestId,
          outcome: value.outcome,
          errorCode: value.errorCode,
        }),
      )
    },
  }
  // An overlay opened during a live session shows its last answer, unless something newer reached the overlay, or
  // another session became live, while it loaded.
  const showLatest = async (sessionId: string, alive: () => boolean) => {
    const revision = arbiter.current.revision
    const open = await api.session(sessionId)
    const active = activeSessionId()
    if (!alive() || arbiter.current.revision !== revision || (active !== undefined && active !== sessionId)) return
    const latest = open.entries.filter((entry) => entry.kind === 'assistant').at(-1)
    setOverlayStream((current) => ({
      ...current,
      answer: latest?.content || '',
      mode: latest?.generation_mode || undefined,
      responseId: latest?.request_id || latest?.id || current.responseId,
      sessionId,
      outcome: 'saved',
      streaming: false,
      errorCode: undefined,
    }))
  }
  return { overlayStream, events, showLatest }
}
