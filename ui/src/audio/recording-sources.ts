import { createInput, drainWorklet, releaseInput, type InputNode } from './worklet-input'

export interface SourceEvents {
  // A block as the recording keeps it, or null while it is paused.
  record: (speaker: string, samples: Int16Array) => Int16Array | null
  recorded?: (samples: Int16Array) => void
  drained: (chunks: Int16Array[], speaker: string) => void
  // The blocks that had arrived before a drain failed.
  salvage: (chunks: Int16Array[], speaker: string) => void
  notify: (message?: string) => void
  // A periodic drain failed.
  failed: (error: Error) => void
  // A source stopped on its own, without being switched away.
  ended: () => void
}

// The audio graph of one recording: its 16 kHz context and the sources connected to it. Each source drains its
// worklet into the recording on a timer and when it is removed.
export class RecordingSources {
  private context: AudioContext | null = null
  private inputs: InputNode[] = []
  private events: SourceEvents

  constructor(events: SourceEvents) {
    this.events = events
  }

  // The running graph's sample rate; none once the recording has ended.
  get rate() {
    return this.context?.sampleRate
  }

  // Loads the PCM worklet and starts the graph. The context is kept before each wait, so a stop that comes meanwhile
  // closes it.
  async open(ensureCurrent: () => void) {
    const context = new AudioContext({ sampleRate: 16000 })
    this.context = context
    await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}pcm-worklet.js`)
    ensureCurrent()
    await context.resume()
    ensureCurrent()
  }

  add(
    source: { stream: MediaStream; speaker: string; owner: MediaStream },
    timing: { blockSize: number; drainMs: number; paused: boolean },
  ) {
    if (!this.context) throw new Error('Audio is not ready.')
    const input = createInput(this.context, source.stream, source.speaker, source.owner, timing.blockSize)
    input.node.port.onmessage = (event: MessageEvent<{ type: string; buffer?: ArrayBuffer; id?: string }>) => {
      if (event.data.type === 'samples' && event.data.buffer) {
        const samples = this.events.record(input.speaker, new Int16Array(event.data.buffer))
        if (!samples?.length) return
        input.chunks.push(samples)
        this.events.recorded?.(samples)
      } else if (event.data.type === 'flushed' && event.data.id) input.acks.get(event.data.id)?.()
    }
    input.timer = window.setInterval(() => {
      input.flushPromise = input.flushPromise
        .then(() => this.flush(input, false))
        .catch((error: Error) => this.events.failed(error))
    }, timing.drainMs)
    this.inputs.push(input)
    if (timing.paused) input.node.port.postMessage({ type: 'pause', paused: true })
    for (const track of source.owner.getTracks())
      track.addEventListener('ended', () => {
        if (!input.detached) this.events.ended()
      })
  }

  post(message: { type: 'pause'; paused: boolean } | { type: 'block'; size: number }) {
    for (const input of this.inputs) input.node.port.postMessage(message)
  }

  mute(muted: boolean) {
    for (const input of this.inputs)
      if (input.speaker === 'ME') for (const track of input.stream.getAudioTracks()) track.enabled = !muted
  }

  // Drains the incoming sources into the recording and releases them; the microphone keeps recording.
  async detachIncoming() {
    const incoming = this.inputs.filter((input) => input.speaker === 'THEY')
    this.inputs = this.inputs.filter((input) => input.speaker !== 'THEY')
    for (const input of incoming) input.detached = true
    await this.drain(incoming)
  }

  // Drains and releases every source; the first that could not be drained is the failure.
  async drainAll() {
    const failure = await this.drain(this.inputs)
    this.inputs = []
    return failure
  }

  async close() {
    if (!this.context) return
    if (this.context.state !== 'closed') await this.context.close()
    this.context = null
  }

  private async drain(inputs: InputNode[]) {
    for (const input of inputs) window.clearInterval(input.timer)
    const flushed = await Promise.allSettled(
      inputs.map(async (input) => {
        await input.flushPromise
        await this.flush(input, true)
      }),
    )
    const failures = flushed.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    for (const result of failures)
      this.events.notify(result.reason instanceof Error ? result.reason.message : 'Audio flush failed.')
    for (const input of inputs) releaseInput(input)
    if (!failures.length) return null
    return failures[0].reason instanceof Error ? failures[0].reason : new Error('Audio flush failed.')
  }

  private async flush(input: InputNode, stop: boolean) {
    try {
      await drainWorklet(input, stop)
    } catch (error) {
      const chunks = input.chunks.splice(0)
      if (chunks.length) this.events.salvage(chunks, input.speaker)
      throw error
    }
    this.events.drained(input.chunks.splice(0), input.speaker)
  }
}
