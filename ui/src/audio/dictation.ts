import { AudioCapture } from './capture'
import type { WorkspaceApi } from '@/bridge/types/api'
import type { Settings } from '@/bridge/types/settings'

type DictationApi = Pick<WorkspaceApi, 'transcribeMemory' | 'cancel'>

export class QuestionDictation {
  private capture: AudioCapture | null = null
  private requests = new Set<string>()
  private version = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  private api: DictationApi
  private onText: (text: string) => void
  private onError: (message: string) => void
  private onStopped: () => void

  constructor(
    api: DictationApi,
    onText: (text: string) => void,
    onError: (message: string) => void,
    onStopped: () => void,
  ) {
    this.api = api
    this.onText = onText
    this.onError = onError
    this.onStopped = onStopped
  }

  async start(settings: Settings) {
    if (this.capture) throw new Error('Dictation is already active.')
    const version = ++this.version
    const capture = new AudioCapture(
      {
        transcribe: async (segment) => {
          if (version !== this.version) throw new DOMException('Dictation cancelled.', 'AbortError')
          const requestId = crypto.randomUUID()
          this.requests.add(requestId)
          try {
            const value = await this.api.transcribeMemory({ requestId, mime: 'audio/wav', bytes: segment.bytes })
            if (version === this.version && value) this.onText(value)
          } finally {
            this.requests.delete(requestId)
          }
        },
      },
      (message) => {
        if (message && version === this.version) this.onError(message)
      },
    )
    this.capture = capture
    try {
      await capture.start('memory-dictation', { ...settings, systemAudio: false })
      if (version !== this.version) {
        await capture.stop()
        return
      }
      this.timer = setTimeout(() => {
        void this.stop().catch((error: unknown) =>
          this.onError(error instanceof Error ? error.message : 'Dictation failed.'),
        )
      }, 30000)
    } catch (error) {
      if (this.capture === capture) this.capture = null
      capture.dispose()
      if (version === this.version) this.onStopped()
      throw error
    }
  }

  async stop() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const capture = this.capture
    if (!capture) return
    const version = this.version
    try {
      await capture.stop()
    } finally {
      capture.discardFailed()
      capture.dispose()
      if (this.capture === capture) this.capture = null
      if (version === this.version) this.onStopped()
    }
  }

  cancel() {
    this.version++
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    for (const id of this.requests) void this.api.cancel(id).catch(() => undefined)
    this.requests.clear()
    const capture = this.capture
    this.capture = null
    if (capture)
      void capture
        .stop()
        .catch(() => undefined)
        .finally(() => {
          capture.discardFailed()
          capture.dispose()
        })
    this.onStopped()
  }
}
