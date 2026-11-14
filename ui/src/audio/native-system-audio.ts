import type { Unsubscribe } from '@/bridge/types/subscription'
import type { CaptureApi, CaptureSegment } from './capture-api'

// The native helper's incoming audio for one recording. A window that supports leases shares the native capture;
// the lease is set before asking, so a start cancelled meanwhile still releases it.
export class NativeSystemAudio {
  active = false
  private starting = false
  private lease: string | null = null
  private leases = 0
  private sessionId = ''
  private api: CaptureApi
  private notify: (message?: string) => void

  constructor(api: CaptureApi, notify: (message?: string) => void) {
    this.api = api
    this.notify = notify
  }

  // Whether the helper's audio belongs to the recording, including while it starts.
  get receiving() {
    return this.active || this.starting
  }

  // The helper's packets for the session it records, as 16 kHz PCM16 after a 44-byte WAV header, and its errors.
  listen(on: { packet: (segment: CaptureSegment, samples: Int16Array) => void; error: (message: string) => void }) {
    const unsubs: Unsubscribe[] = []
    if (this.api.onSystemAudio)
      unsubs.push(
        this.api.onSystemAudio((segment) => {
          if (this.receiving && segment.sessionId === this.sessionId)
            on.packet(segment, new Int16Array(segment.bytes.slice(44)))
        }),
      )
    if (this.api.onSystemAudioError)
      unsubs.push(
        this.api.onSystemAudioError((message) => {
          if (this.active) on.error(message)
        }),
      )
    return unsubs
  }

  async start(sessionId: string, ensureCurrent: () => void) {
    this.sessionId = sessionId
    this.starting = true
    try {
      if (this.api.acquireSystemAudio) {
        this.lease = `capture-${++this.leases}`
        const result = await this.api.acquireSystemAudio(this.lease, sessionId)
        if (result?.cancelled)
          throw Object.assign(new Error(result.error || 'Incoming audio start was cancelled.'), { name: 'AbortError' })
        if (result?.fellBack)
          this.notify(
            `The process tap could not start, so incoming audio uses ScreenCaptureKit. ${result.reason || ''}`,
          )
      } else await this.api.startSystemAudio?.(sessionId)
      ensureCurrent()
      this.active = true
    } finally {
      this.starting = false
    }
  }

  // Switching sources drops the helper's audio at once.
  release() {
    return this.stop(false)
  }

  // Ending the recording keeps the helper's audio until the helper has stopped.
  end() {
    return this.stop(true)
  }

  private async stop(keepUntilStopped: boolean) {
    const lease = this.lease
    this.lease = null
    if (!lease && !this.receiving) return
    if (!keepUntilStopped) this.active = false
    const stopping = lease ? this.api.releaseSystemAudio?.(lease) : this.api.stopSystemAudio?.()
    await stopping?.catch((error: Error) => this.notify(error.message))
    this.active = false
  }
}
