import { blockLevel } from './level-meter'

export function createMicrophoneProbe({
  open,
  createContext,
  every,
  cancel,
  changed,
}: {
  open: (deviceId: string) => Promise<MediaStream>
  createContext: () => AudioContext
  every: (read: () => void) => number
  cancel: (id: number) => void
  changed: (level: number) => void
}) {
  let revision = 0
  let stream: MediaStream | null = null
  let context: AudioContext | null = null
  let timer: number | null = null
  const stop = async () => {
    revision++
    if (timer !== null) cancel(timer)
    timer = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    const closing = context
    context = null
    changed(0)
    await closing?.close()
  }
  return {
    stop,
    async start(deviceId: string) {
      const stopped = stop()
      const current = revision
      await stopped
      const opened = await open(deviceId)
      if (current !== revision) {
        opened.getTracks().forEach((track) => track.stop())
        return false
      }
      stream = opened
      try {
        context = createContext()
        const graph = context
        await graph.resume()
        if (current !== revision) return false
        const analyser = graph.createAnalyser()
        analyser.fftSize = 512
        const silence = graph.createGain()
        silence.gain.value = 0
        graph.createMediaStreamSource(opened).connect(analyser)
        analyser.connect(silence)
        silence.connect(graph.destination)
        const samples = new Float32Array(analyser.fftSize)
        timer = every(() => {
          analyser.getFloatTimeDomainData(samples)
          changed(blockLevel(Int16Array.from(samples, (value) => Math.max(-32768, Math.min(32767, value * 32768)))))
        })
        return true
      } catch (error) {
        await stop()
        throw error
      }
    },
  }
}
