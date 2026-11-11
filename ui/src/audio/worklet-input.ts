// One recorded source: its stream, the PCM worklet that turns it into 16-bit blocks, and the blocks gathered since
// the last drain.
export interface InputNode {
  stream: MediaStream
  owner: MediaStream
  speaker: string
  source: MediaStreamAudioSourceNode
  node: AudioWorkletNode
  sink: GainNode
  chunks: Int16Array[]
  acks: Map<string, () => void>
  timer: number
  flushPromise: Promise<void>
  // Set when the source is replaced during a recording, so stopping its tracks does not end the recording.
  detached?: boolean
}

// Connects a stream to the PCM worklet through a silent sink, so it is processed without being played back.
export function createInput(
  context: AudioContext,
  stream: MediaStream,
  speaker: string,
  owner: MediaStream,
  blockSize: number,
): InputNode {
  const source = context.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(context, 'pcm-recorder', { processorOptions: { blockSize } })
  const sink = context.createGain()
  sink.gain.value = 0
  source.connect(node)
  node.connect(sink)
  sink.connect(context.destination)
  return {
    stream,
    owner,
    speaker,
    source,
    node,
    sink,
    chunks: [],
    acks: new Map(),
    timer: 0,
    flushPromise: Promise.resolve(),
  }
}

// Asks the worklet for the blocks it still holds; a worklet that does not answer within 5 s has stopped.
export function drainWorklet(input: InputNode, stop: boolean) {
  const id = crypto.randomUUID()
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      input.acks.delete(id)
      reject(new Error('The audio processor stopped responding. Listening has ended.'))
    }, 5000)
    input.acks.set(id, () => {
      window.clearTimeout(timeout)
      input.acks.delete(id)
      resolve()
    })
    input.node.port.postMessage({ type: 'flush', id, stop })
  })
}

// Stops the source's tracks and disconnects its audio graph.
export function releaseInput(input: InputNode) {
  input.owner.getTracks().forEach((track) => track.stop())
  input.source.disconnect()
  input.node.disconnect()
  input.sink.disconnect()
  input.node.port.close()
}
