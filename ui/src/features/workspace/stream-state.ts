import type { GenerationOutcome, GenerationFailureCode } from '@/bridge/types/generation'

export interface OverlayStream {
  sessionId?: string
  mode?: string
  outcome: 'idle' | 'running' | 'saved' | 'interrupted' | 'error' | 'cancelled'
  errorCode?: GenerationFailureCode
  answer: string
  streaming: boolean
  responseId: string
  // When the first piece of this answer arrived; the event handler supplies the clock so this stays pure.
  startedAt: string
}
export type OverlayDecision = 'ignore' | 'start' | 'append' | 'answer' | 'finish'

export const initialOverlayStream: OverlayStream = {
  outcome: 'idle',
  answer: '',
  streaming: false,
  responseId: 'initial',
  startedAt: '',
}

// Applies one overlay event after the arbiter decided what it means. Pure, so React may call it twice.
export function nextOverlayStream(
  current: OverlayStream,
  decision: OverlayDecision,
  event: {
    kind: 'delta' | 'answer' | 'finished'
    requestId?: string
    text?: string
    newId?: string
    at?: string
    sessionId?: string
    mode?: string
    outcome?: GenerationOutcome
    errorCode?: GenerationFailureCode
  },
): OverlayStream {
  if (decision === 'ignore') return current
  const mode = event.mode ?? (decision === 'start' ? undefined : current.mode)
  const sessionId = event.sessionId || current.sessionId
  if (event.kind === 'delta')
    return {
      answer: decision === 'start' ? event.text || '' : current.answer + (event.text || ''),
      ...(sessionId ? { sessionId } : {}),
      ...(mode ? { mode } : {}),
      outcome: 'running',
      streaming: true,
      responseId: event.requestId || current.responseId,
      startedAt: decision === 'start' ? event.at || '' : current.startedAt || event.at || '',
    }
  if (event.kind === 'answer')
    return {
      answer: event.text || '',
      ...(sessionId ? { sessionId } : {}),
      ...(mode ? { mode } : {}),
      outcome: 'saved',
      streaming: false,
      responseId: event.requestId || event.newId || current.responseId,
      startedAt: current.startedAt,
    }
  if (decision !== 'finish') return current
  if (current.outcome === 'saved') return { ...current, streaming: false }
  let outcome: OverlayStream['outcome'] = current.outcome
  if (event.outcome === 'success') outcome = 'idle'
  else if (event.outcome) outcome = event.outcome
  else if (current.outcome === 'running') outcome = 'interrupted'
  return { ...current, streaming: false, outcome, ...(outcome === 'error' ? { errorCode: event.errorCode } : {}) }
}

export function streamStatus(outcome: OverlayStream['outcome'], errorCode?: GenerationFailureCode) {
  if (outcome === 'error')
    return {
      key: errorCode === 'timeout' ? 'overlay.generationTimeout' : 'overlay.generationFailed',
      role: 'alert',
    } as const
  if (outcome === 'cancelled') return { key: 'overlay.cancelled', role: 'status' } as const
  if (outcome === 'interrupted') return { key: 'overlay.interrupted', role: 'status' } as const
  return null
}
