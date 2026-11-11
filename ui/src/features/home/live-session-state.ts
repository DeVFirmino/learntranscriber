import type { PublicState } from '@/bridge/types/state'

// The recording running now, if any: whether it is paused, when it started and the session it writes to.
export function liveSession(state: PublicState) {
  const listening = state.overlay.listening
  if (!listening?.active) return null
  return {
    paused: Boolean(listening.paused),
    since: listening.since ?? null,
    session: state.sessions.find((item) => item.id === state.activeSessionId) ?? null,
  }
}

export type LiveSession = NonNullable<ReturnType<typeof liveSession>>
