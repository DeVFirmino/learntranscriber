import type { AudioLevels } from '@/bridge/types/audio'
import type { Unsubscribe } from '@/bridge/types/subscription'
import type { CaptureApi, CaptureSegment } from './capture-api'
import type { AudioSettings } from './capture-settings'
import type { EchoReduction } from './echo-reduction'
import { IncomingSource } from './incoming-source'
import { LevelMeter } from './level-meter'
import { openMicrophone } from './incoming-streams'
import { LiveCaptionSession } from './live-captions'
import { NativeSystemAudio } from './native-system-audio'
import { RecordingEcho } from './recording-echo'
import { RecordingSources } from './recording-sources'
import { SegmentDelivery } from './segment-delivery'

export interface CaptureOptions {
  onSamples?: (samples: Int16Array) => void
  segmentMs?: number
  // The session recording passes the window's echo reduction; other microphone uses record without it.
  echo?: EchoReduction
  // Each side's loudness while recording, for the floating bar's live wave.
  onLevels?: (levels: AudioLevels) => void
}

// What the pipeline reads from the capture, which owns when a recording runs.
export interface PipelineHost {
  sessionId(): string
  paused(): boolean
  recording(): boolean
  stopping(): boolean
  // Stops the recording after a failure, telling the user why when there is a message.
  end(message?: string): void
  incomingFailed(message: string): void
}

type EnsureCurrent = (stream?: MediaStream) => void

// Everything a recording runs through: echo reduction, the native helper's incoming audio, live captions, the audio
// graph's sources, and the delivery of what they record. The capture decides when; this decides how.
export class RecordingPipeline {
  readonly echo: RecordingEcho
  readonly native: NativeSystemAudio
  readonly live: LiveCaptionSession
  readonly delivery: SegmentDelivery
  readonly sources: RecordingSources
  readonly incoming: IncomingSource
  private meter: LevelMeter | null
  private host: PipelineHost
  private options: CaptureOptions

  constructor(api: CaptureApi, notify: (message?: string) => void, options: CaptureOptions, host: PipelineHost) {
    this.host = host
    this.options = options
    this.meter = options.onLevels ? new LevelMeter(options.onLevels) : null
    this.echo = new RecordingEcho(options.echo)
    this.native = new NativeSystemAudio(api, notify)
    this.live = new LiveCaptionSession(api)
    this.delivery = new SegmentDelivery({ api, notify, recording: host.recording, halt: () => host.end() })
    const target = () => ({ sessionId: host.sessionId(), live: this.live.active, rate: this.sources.rate })
    this.sources = new RecordingSources({
      record: (speaker, samples) => {
        if (host.paused()) return null
        this.meter?.feed(speaker, samples)
        return this.echo.block(speaker, samples, this.sources.rate || 16000)
      },
      recorded: options.onSamples,
      drained: (chunks, speaker) => this.delivery.drained(chunks, speaker, target()),
      salvage: (chunks, speaker) => this.delivery.salvaged(chunks, speaker, target()),
      notify,
      failed: (error) => host.end(error.message),
      ended: () => {
        if (host.recording() && !host.stopping()) host.end('An audio source stopped. Listening has ended.')
      },
    })
    this.incoming = new IncomingSource({
      native: this.native,
      sources: this.sources,
      add: (stream, owner) => this.addSource(stream, 'THEY', owner),
      follow: (settings) => {
        this.meter?.resetSpeaker('THEY')
        this.echo.follow(settings)
        this.live.follow(settings)
      },
      sessionId: host.sessionId,
      notify,
    })
  }

  // The helper's incoming audio and errors and the live caption errors.
  listen(): Unsubscribe[] {
    const end = (message: string) => this.host.end(message)
    const packet = (segment: CaptureSegment, samples: Int16Array) => {
      if (this.host.paused()) return
      this.meter?.feed('THEY', samples)
      this.echo.analyzeIncoming(samples, 16000)
      if (!this.live.active) this.delivery.segment(segment)
      else if (this.live.forwardsHelper) this.delivery.live(samples, segment.speaker, this.host.sessionId())
    }
    const incomingFailed = (message: string) => {
      this.meter?.resetSpeaker('THEY')
      this.host.incomingFailed(message)
      void this.incoming.stop().catch((error) => this.host.incomingFailed(String(error)))
    }
    return [...this.native.listen({ packet, error: incomingFailed }), ...this.live.listen(end)]
  }

  // Live captions, echo reduction, the audio graph and the microphone, in that order. The
  // canceller is loaded before the microphone starts; without it the microphone is recorded unprocessed.
  async begin(sessionId: string, settings: AudioSettings, ensureCurrent: EnsureCurrent) {
    await this.live.start(sessionId, settings, ensureCurrent)
    this.echo.start(settings)
    await this.sources.open(ensureCurrent)
    await this.echo.prepare()
    ensureCurrent()
    this.addSource(await openMicrophone(settings.microphoneId, ensureCurrent), 'ME')
  }

  // Turning echo reduction on or off during a recording also switches the worklets to the block size it needs.
  setEchoReduction(enabled: boolean) {
    if (this.echo.setEnabled(enabled)) this.sources.post({ type: 'block', size: this.echo.blockSize })
  }

  // Pausing stops the worklets' blocks, starts the canceller fresh and pauses live captions; if the captions cannot
  // follow, the worklets go back as they were.
  async pause(paused: boolean) {
    if (paused) this.meter?.reset()
    this.sources.post({ type: 'pause', paused })
    this.echo.resetCapture()
    try {
      await this.live.pause(paused)
    } catch (error) {
      this.sources.post({ type: 'pause', paused: !paused })
      throw error
    }
  }

  // Ends a recording in order: the helper stops, every source drains, the graph closes, queued audio is delivered
  // and live captions stop. The first source that could not be drained is returned as the failure.
  async end() {
    this.meter?.reset()
    await this.native.end()
    const drainFailure = await this.sources.drainAll()
    this.echo.stop()
    await this.sources.close()
    await this.delivery.settled()
    const liveStop = await this.live.stop()
    if (liveStop) this.delivery.liveFailed(liveStop)
    return drainFailure
  }

  private addSource(stream: MediaStream, speaker: string, owner: MediaStream = stream) {
    const drainMs = this.live.active ? 1000 : this.options.segmentMs || 8000
    this.sources.add(
      { stream, speaker, owner },
      { blockSize: this.echo.blockSize, drainMs, paused: this.host.paused() },
    )
  }
}
