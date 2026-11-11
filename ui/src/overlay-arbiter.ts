export type OverlayEvent = {
  kind: 'delta' | 'answer' | 'finished'
  requestId?: string
  sessionId?: string
  sequence?: number
}
export type OverlayDecision = 'ignore' | 'start' | 'append' | 'answer' | 'finish'

/**
 * Decides whether a main-process overlay event may change what the floating surfaces show.
 * Main stamps each generation with its admission sequence: the newest admitted generation wins, so an
 * older stream, its late answer or its finish never replaces newer output. Events for another session,
 * deltas of finished requests, and events without a sequence (fixtures, older main processes) keep the
 * request-identity rules. `revision` changes whenever the display changes, so a slow initial load can tell
 * that newer output arrived while it waited.
 */
export class OverlayArbiter {
  current: string | null = null
  streaming = false
  revision = 0
  private shown = 0
  private completed: string[] = []

  decide(event: OverlayEvent, activeSessionId: string | null | undefined): OverlayDecision {
    const decision = this.choose(event, activeSessionId)
    if (decision !== 'ignore') this.revision++
    return decision
  }

  private choose(event: OverlayEvent, activeSessionId: string | null | undefined): OverlayDecision {
    if (event.sessionId && activeSessionId && event.sessionId !== activeSessionId) return 'ignore'
    const id = event.requestId
    const sequence = event.sequence
    if (sequence !== undefined && sequence < this.shown) return 'ignore'
    if (event.kind === 'delta') {
      if (!id || this.completed.includes(id)) return 'ignore'
      const started = this.current !== id
      this.current = id
      this.streaming = true
      if (sequence !== undefined) this.shown = sequence
      return started ? 'start' : 'append'
    }
    if (event.kind === 'answer') {
      if (sequence === undefined && id && this.streaming && this.current && id !== this.current) return 'ignore'
      if (id) this.complete(id)
      if (sequence !== undefined) {
        this.shown = sequence
        this.current = id || this.current
      }
      this.streaming = false
      return 'answer'
    }
    if (!id) return 'ignore'
    this.complete(id)
    if (this.current !== id) return 'ignore'
    this.streaming = false
    return 'finish'
  }

  private complete(id: string) {
    if (!this.completed.includes(id)) this.completed.push(id)
    if (this.completed.length > 50) this.completed.shift()
  }
}
