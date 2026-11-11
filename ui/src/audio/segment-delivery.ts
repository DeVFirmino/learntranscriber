import type { CaptureApi, CaptureSegment } from './capture-api'
import { encodeWav, joinPcm } from './pcm'

// Live frames are sent in seconds of 16 kHz audio.
const LIVE_FRAME_SAMPLES = 32000
// Segments still waiting for transcription before the recording stops as falling behind.
const MAX_PENDING = 6

// Where one drain's audio goes: the recording's session, as live frames or as WAV segments at the recording's rate.
// Without a rate the audio graph is gone and only live audio is still sent.
export interface DrainTarget {
  sessionId: string
  live: boolean
  rate?: number
}

// Sends recorded audio in order per speaker: as live frames while live captions run, otherwise as segments to
// transcribe. Audio that cannot be delivered is kept as a retryable segment of the session it was recorded for, and
// the failure ends the recording.
export class SegmentDelivery {
  pending = 0
  failed: CaptureSegment[] = []
  // Live frames the main process refused; they also fail the next stop.
  private liveFailures: Error[] = []
  private queues = new Map<string, Promise<void>>()
  private api: CaptureApi
  private notify: (message?: string) => void
  private recording: () => boolean
  private halt: () => void

  constructor(options: {
    api: CaptureApi
    notify: (message?: string) => void
    recording: () => boolean
    halt: () => void
  }) {
    this.api = options.api
    this.notify = options.notify
    this.recording = options.recording
    this.halt = options.halt
  }

  // One drain's blocks; a silent or very short segment is not transcribed.
  drained(chunks: Int16Array[], speaker: string, target: DrainTarget) {
    if (target.live) return this.live(joinPcm(chunks), speaker, target.sessionId)
    if (!target.rate) return
    const wav = encodeWav(chunks, target.rate)
    if (wav.sampleCount > 1000 && wav.peak > 3)
      this.segment({ sessionId: target.sessionId, speaker, mime: 'audio/wav', bytes: wav.buffer })
  }

  // The blocks that arrived before a drain failed are kept as a retryable segment; live audio is still sent.
  salvaged(chunks: Int16Array[], speaker: string, target: DrainTarget) {
    if (target.live) return this.drained(chunks, speaker, target)
    if (!target.rate) return
    const wav = encodeWav(chunks, target.rate)
    this.failed.push({ sessionId: target.sessionId, speaker, mime: 'audio/wav', bytes: wav.buffer })
  }

  live(samples: Int16Array, speaker: string, sessionId: string) {
    for (let offset = 0; offset < samples.length; offset += LIVE_FRAME_SAMPLES) {
      const frame = samples.slice(offset, offset + LIVE_FRAME_SAMPLES)
      this.queue(speaker, async () => {
        try {
          await this.api.pushLiveAudio?.({ sessionId, speaker, samples: frame.buffer })
        } catch (error) {
          const failure = error instanceof Error ? error : new Error('Live audio delivery failed.')
          this.failed.push({ sessionId, speaker, mime: 'audio/wav', bytes: encodeWav([frame], 16000).buffer })
          this.liveFailures.push(failure)
          this.notify(failure.message)
          if (this.recording()) this.halt()
        }
      })
    }
  }

  segment(segment: CaptureSegment) {
    segment.segmentId ||= crypto.randomUUID()
    this.pending++
    this.notify()
    this.queue(segment.speaker, async () => {
      try {
        await this.api.transcribe(segment)
      } catch (error) {
        this.failed.push(segment)
        this.notify(error instanceof Error ? error.message : 'Transcription failed.')
        if (this.recording()) this.halt()
      } finally {
        this.pending--
        this.notify()
      }
    })
    if (this.pending > MAX_PENDING && this.recording()) {
      this.notify('Transcription is falling behind. Listening stopped; queued audio will finish processing.')
      this.halt()
    }
  }

  // Drops the retryable segments, for recordings that do not keep them.
  discard() {
    this.failed = []
  }

  // A live session that did not stop cleanly fails the stop like a refused frame.
  liveFailed(error: Error) {
    this.liveFailures.push(error)
  }

  // The first refused live frame since the last stop, if any; reading it clears the record.
  takeLiveFailure(): Error | undefined {
    const failure = this.liveFailures[0]
    this.liveFailures = []
    return failure
  }

  settled() {
    return Promise.all(this.queues.values())
  }

  async retry() {
    for (const segment of this.failed.splice(0)) this.segment(segment)
    await this.settled()
  }

  private queue(speaker: string, send: () => Promise<void>) {
    this.queues.set(speaker, (this.queues.get(speaker) || Promise.resolve()).then(send))
  }
}
