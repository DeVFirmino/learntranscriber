import type { Unsubscribe } from '@/bridge/types/subscription'
import type { CaptureApi } from './capture-api'
import type { AudioSettings } from './capture-settings'
import { RecordingPipeline, type CaptureOptions } from './recording-pipeline'

// One window's recording: starting and stopping it, switching its incoming source, pausing and muting. Only one
// runs at a time, and anything still arriving for a recording that ended or was replaced is dropped.
export class AudioCapture {
  muted = false
  paused = false
  private pausing = false
  recording = false
  stopping = false
  starting = false
  incomingError = ''
  failure = ''
  private generation = 0
  private switching: Promise<void> = Promise.resolve()
  private sessionId = ''
  private stopPromise: Promise<void> | null = null
  private readonly unsubs: Unsubscribe[] = []
  private readonly pipeline: RecordingPipeline
  private notify: (message?: string) => void

  // Construction has no side effects; the owner connects the native event listeners and disposes them.
  constructor(api: CaptureApi, notify: (message?: string) => void, options: CaptureOptions = {}) {
    this.notify = notify
    this.pipeline = new RecordingPipeline(api, notify, options, {
      sessionId: () => this.sessionId,
      paused: () => this.paused,
      recording: () => this.recording,
      stopping: () => this.stopping,
      incomingFailed: (message) => {
        this.incomingError = message
        notify(message)
      },
      end: (message) => {
        if (message) {
          this.failure = message
          notify(message)
        }
        void this.stop().catch(() => {})
      },
    })
  }

  // Segments waiting for transcription, and the ones that failed and can be retried.
  get pending() {
    return this.pipeline.delivery.pending
  }

  get failed() {
    return this.pipeline.delivery.failed
  }

  // Connecting twice keeps one set of listeners, and connecting again after dispose() restores it.
  connect() {
    if (!this.unsubs.length) this.unsubs.push(...this.pipeline.listen())
  }

  dispose() {
    for (const unsub of this.unsubs) unsub()
    this.unsubs.length = 0
  }

  async start(sessionId: string, settings: AudioSettings) {
    if (this.recording || this.stopping || this.starting) return
    this.incomingError = ''
    this.failure = ''
    this.muted = false
    this.paused = false
    this.sessionId = sessionId
    this.recording = true
    this.starting = true
    const ensureCurrent = this.guard(++this.generation)
    try {
      await this.pipeline.begin(sessionId, settings, ensureCurrent)
      try {
        await this.pipeline.incoming.start(settings, ensureCurrent)
      } catch (error) {
        if (
          String(error).includes('Audio startup was cancelled') ||
          (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
        )
          throw error
        ensureCurrent()
        await this.pipeline.incoming.stop()
        this.incomingError =
          typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
            ? error.message
            : 'Incoming audio could not start.'
        this.notify(this.incomingError)
      }
      this.notify()
    } catch (error) {
      this.failure =
        typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error)
      await this.stop()
      throw error
    } finally {
      this.starting = false
    }
  }

  updateEchoReduction(enabled: boolean) {
    this.pipeline.setEchoReduction(enabled)
  }

  // Stops a stream that arrives after its recording was stopped or replaced, and ends that startup.
  private guard(generation: number) {
    return (stream?: MediaStream) => {
      if (generation === this.generation && this.recording) return
      stream?.getTracks().forEach((track) => track.stop())
      throw new Error('Audio startup was cancelled.')
    }
  }

  // A new incoming source applies at once; switches run one after another, and a stop waits for the one running.
  switchIncoming(settings: AudioSettings) {
    const run = this.switching.then(async () => {
      if (!this.recording || this.stopping || this.starting) return
      const generation = this.generation
      const error = await this.pipeline.incoming.replace(
        settings,
        this.guard(generation),
        () => generation === this.generation && this.recording,
      )
      if (generation === this.generation) {
        this.incomingError = error || ''
        this.notify()
      }
    })
    this.switching = run.catch(() => {})
    return run
  }

  async stop() {
    if (this.stopping) return this.stopPromise ?? Promise.resolve()
    this.stopping = true
    this.recording = false
    this.generation++
    let drainFailure: Error | null = null
    this.stopPromise = (async () => {
      try {
        // A source switch in progress finishes first; the stop then releases whatever it started.
        await this.switching
        drainFailure = await this.pipeline.end()
      } finally {
        this.stopping = false
        this.notify()
      }
      // Stopping with an incomplete final drain or undelivered live audio is a failure: ending the session
      // must not treat it as complete.
      const liveFailure = this.pipeline.delivery.takeLiveFailure()
      if (drainFailure) throw drainFailure
      if (liveFailure) throw liveFailure
    })()
    return this.stopPromise
  }

  muteMicrophone() {
    this.muted = !this.muted
    this.pipeline.sources.mute(this.muted)
    this.notify()
    return this.muted
  }

  async togglePause() {
    if (!this.recording || this.starting || this.stopping || this.pausing) return
    if (!this.pipeline.live.pausable) throw new Error('Pause requires the native Mac app.')
    this.pausing = true
    const previous = this.paused
    this.paused = !previous
    try {
      await this.pipeline.pause(this.paused)
    } catch (error) {
      this.paused = previous
      throw error
    } finally {
      this.pausing = false
      this.notify()
    }
  }

  retry() {
    return this.pipeline.delivery.retry()
  }

  discardFailed() {
    this.pipeline.delivery.discard()
  }
}
