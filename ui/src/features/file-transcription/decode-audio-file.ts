import { FILE_SAMPLE_RATE } from './file-plan'

// Decodes an audio or video file's sound with the browser's own decoders (MP3, AAC/M4A, WAV, and the audio of MP4
// and MOV), then mixes it to one channel at 16 kHz, the rate every transcription engine here accepts.
export async function decodeAudioFile(file: File): Promise<Float32Array> {
  const data = await file.arrayBuffer()
  const context = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await context.decodeAudioData(data)
  } catch {
    throw new Error('This file has no audio this Mac can decode.')
  } finally {
    void context.close()
  }
  const length = Math.max(1, Math.ceil(decoded.duration * FILE_SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, length, FILE_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}
