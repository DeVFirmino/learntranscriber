interface Hooks {
  newId(): string
  evaluate(input: { requestId: string; sessionId: string; mode: string; liveTranscript: string }): Promise<string>
  cancel(id: string): Promise<unknown>
}

// A model decision can relax the speaking guard only for the current uninterrupted speech run.
export class HesitationMonitor {
  private sessionId: string | null = null
  private speakingSince: number | null = null
  private checked = ''
  private hesitating = false
  private requestId: string | null = null
  private revision = 0
  private hooks: Hooks
  constructor(hooks: Hooks) {
    this.hooks = hooks
  }

  reset() {
    const pending = this.requestId
    this.requestId = null
    this.sessionId = null
    this.speakingSince = null
    this.checked = ''
    this.hesitating = false
    this.revision++
    if (pending) void this.hooks.cancel(pending).catch(() => {})
  }

  async update({ sessionId, text, enabled, now }: { sessionId: string; text: string; enabled: boolean; now: number }) {
    const speech = text.trim().slice(-20_000)
    if (this.sessionId !== sessionId) {
      this.reset()
      this.sessionId = sessionId
    }
    if (!enabled || !speech) {
      this.reset()
      return false
    }
    this.speakingSince ??= now
    if (this.hesitating) return true
    if (this.requestId || now - this.speakingSince < 4_000 || speech.split(/\s+/).length < 3 || this.checked === speech)
      return false
    const revision = this.revision
    const id = this.hooks.newId()
    this.requestId = id
    this.checked = speech
    try {
      const answer = await this.hooks.evaluate({
        requestId: id,
        sessionId,
        mode: 'insightHesitation',
        liveTranscript: speech,
      })
      if (this.revision !== revision || this.requestId !== id) return false
      this.hesitating = answer === 'HESITATING'
      return this.hesitating
    } catch {
      return false
    } finally {
      if (this.requestId === id) this.requestId = null
    }
  }
}
