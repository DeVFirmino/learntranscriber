import type { Unsubscribe } from './subscription'

export type GenerationOutcome = 'success' | 'error' | 'cancelled'
export type GenerationFailureCode = 'generationFailed' | 'timeout'

export interface FollowUpSuggestion {
  text: string
  prompt: string
}

export interface GenerationApi {
  followUps: (input: {
    requestId: string
    sessionId: string
    entryId: string
    historical?: boolean
  }) => Promise<{ entryId: string; suggestions: FollowUpSuggestion[] }>
  translateEntry: (input: {
    requestId: string
    sessionId: string
    entryId: string
    language: string
  }) => Promise<{ entryId: string; language: string; text: string }>
  generate: (input: {
    requestId: string
    sessionId: string
    mode: string
    question?: string
    image?: string
    images?: string[]
    context?: string
    liveTranscript?: string
    draft?: string
    instructions?: string
  }) => Promise<string>
  cancel: (id: string) => Promise<boolean>
  copyResponseCode: (value: string) => Promise<unknown>
  openResponseLink: (url: string) => Promise<unknown>
  onDelta: (listener: (value: { requestId: string; delta: string }) => void) => Unsubscribe
  onOverlayDelta: (
    listener: (value: {
      requestId: string
      sessionId?: string
      mode?: string
      delta: string
      sequence?: number
    }) => void,
  ) => Unsubscribe
  onOverlayAnswer: (
    listener: (value: {
      text: string
      mode?: string
      sessionId?: string
      requestId?: string
      entryId?: string
      displayAckId?: string
      sequence?: number
    }) => void,
  ) => Unsubscribe
  onOverlayFinished: (
    listener: (value: {
      requestId: string
      sessionId?: string
      mode?: string
      sequence?: number
      outcome?: GenerationOutcome
      errorCode?: GenerationFailureCode
    }) => void,
  ) => Unsubscribe
}
