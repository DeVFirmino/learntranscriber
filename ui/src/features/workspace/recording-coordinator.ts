import type { Settings } from '@/bridge/types/settings'
import type { PublicState } from '@/bridge/types/state'

export interface RecordingAudio {
  recording: boolean
  paused: boolean
  stopping: boolean
  failed: unknown[]
  start(sessionId: string, settings: Settings): Promise<unknown>
  stop(): Promise<unknown>
  togglePause(): Promise<unknown>
}

// Meeting listening and dictation exclusion while recording; when to ask for an insight is the insight scheduler's
// decision.
export class RecordingCoordinator {
  dictating = false

  // Dictation or history voice is using the microphone, which blocks meeting listening until it ends.
  setDictating(active: boolean) {
    this.dictating = active
  }
  starting = false
  private audio: RecordingAudio

  constructor(audio: RecordingAudio) {
    this.audio = audio
  }

  async toggle(
    ensureSession: () => Promise<void>,
    readState: () => Promise<PublicState>,
    reportStarting: (starting: boolean) => unknown = () => {},
  ) {
    if (this.starting) return
    if (this.audio.recording) {
      await this.audio.stop()
      return
    }
    if (this.dictating) throw new Error('Stop history voice or dictation before meeting listening.')
    this.starting = true
    try {
      await reportStarting(true)
      await ensureSession()
      const current = await readState()
      if (!current?.activeSessionId) throw new Error('Start or resume a session before listening.')
      if (current.settings.transcriptionProvider === 'openai' && !current.credentials.openai)
        throw new Error('Add an OpenAI key or select local transcription in Settings.')
      await this.audio.start(current.activeSessionId, current.settings)
    } finally {
      this.starting = false
      await reportStarting(false)
    }
  }

  recording() {
    return this.audio.recording
  }

  timerShouldRun(overlay: boolean, sessionTimer: boolean | undefined) {
    return !overlay && Boolean(sessionTimer) && this.audio.recording && !this.audio.paused
  }

  async pauseForReminder() {
    if (!this.audio.recording || this.audio.paused) return false
    await this.audio.togglePause()
    return this.audio.paused
  }

  // Leaving the page would lose audio that is recording, flushing, failed or being dictated.
  blocksUnload() {
    return this.audio.recording || this.audio.stopping || this.audio.failed.length > 0 || this.dictating
  }
}
