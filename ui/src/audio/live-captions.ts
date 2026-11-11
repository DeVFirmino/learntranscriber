import type { Unsubscribe } from '@/bridge/types/subscription'
import type { CaptureApi } from './capture-api'
import { appleHearsHelper, liveCaptions, type AudioSettings } from './capture-settings'

// Live captions for one recording: the main process transcribes the audio as the window sends it.
export class LiveCaptionSession {
  active = false
  private appleDirect = false
  private sessionId = ''
  private api: CaptureApi

  constructor(api: CaptureApi) {
    this.api = api
  }

  // Whether the window forwards the native helper's incoming audio to the captions.
  get forwardsHelper() {
    return this.active && !this.appleDirect
  }

  // Pausing a live recording needs the native app to pause the captions too.
  get pausable() {
    return !this.active || Boolean(this.api.setLivePaused)
  }

  // Caption errors of the running session.
  listen(onError: (message: string) => void): Unsubscribe[] {
    if (!this.api.onLiveCaption) return []
    return [
      this.api.onLiveCaption((caption) => {
        if (this.active && caption.sessionId === this.sessionId && caption.error) onError(caption.error)
      }),
    ]
  }

  async start(sessionId: string, settings: AudioSettings, ensureCurrent: () => void) {
    if (!liveCaptions(settings)) return
    this.sessionId = sessionId
    if (!this.api.startLiveTranscription || !this.api.pushLiveAudio || !this.api.stopLiveTranscription)
      throw new Error('Live captions require the native Mac app.')
    await this.api.startLiveTranscription(sessionId)
    this.active = true
    this.appleDirect = appleHearsHelper(settings)
    ensureCurrent()
  }

  // A new incoming source may change whether Apple Speech hears it directly.
  follow(settings: AudioSettings) {
    if (this.active) this.appleDirect = appleHearsHelper(settings)
  }

  async pause(paused: boolean) {
    if (this.active) await this.api.setLivePaused?.(paused)
  }

  // A live session that does not stop cleanly is returned as the stop's failure.
  async stop(): Promise<Error | null> {
    if (!this.active) return null
    this.active = false
    this.appleDirect = false
    try {
      await this.api.stopLiveTranscription?.()
      return null
    } catch (error) {
      return error instanceof Error ? error : new Error('Live transcription did not stop cleanly.')
    }
  }
}
