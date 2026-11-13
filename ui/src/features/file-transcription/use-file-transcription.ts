import { useRef, useState } from 'react'
import { encodeWav, float32ToPcm16 } from '@/audio/pcm'
import { useWorkspace } from '@/workspace'
import { chunkRanges, chunkSegmentId, fileSessionTitle, FILE_SAMPLE_RATE, MAX_FILE_BYTES } from './file-plan'
import { decodeAudioFile } from './decode-audio-file'

export type FileTranscriptionState =
  | { phase: 'idle' }
  | { phase: 'decoding'; name: string }
  | { phase: 'transcribing'; name: string; done: number; total: number }

// Below this peak a chunk is silence: it is skipped rather than sent, so a pause never becomes a line.
const SILENT_PEAK = 200

// Transcribes a chosen audio or video file into a new session with the configured engine, 30 seconds at a time, then
// ends the session and opens it. Cancel stops after the chunk in flight; what was transcribed stays.
export function useFileTranscription() {
  const ws = useWorkspace()
  const [state, setState] = useState<FileTranscriptionState>({ phase: 'idle' })
  const cancelled = useRef(false)
  const start = (file: File) =>
    ws.act(async () => {
      if (file.size > MAX_FILE_BYTES) throw new Error('Choose an audio or video file up to 2 GB.')
      cancelled.current = false
      const session = await ws.api.createSession(fileSessionTitle(file.name))
      try {
        setState({ phase: 'decoding', name: file.name })
        const samples = await decodeAudioFile(file)
        const ranges = chunkRanges(samples.length)
        for (const [index, range] of ranges.entries()) {
          if (cancelled.current) break
          setState({ phase: 'transcribing', name: file.name, done: index, total: ranges.length })
          const { buffer, peak } = encodeWav(
            [float32ToPcm16(samples.subarray(range.start, range.end))],
            FILE_SAMPLE_RATE,
          )
          if (peak < SILENT_PEAK) continue
          await ws.api.transcribe({
            sessionId: session.id,
            speaker: 'THEY',
            mime: 'audio/wav',
            bytes: buffer,
            segmentId: chunkSegmentId(session.id, index),
          })
        }
      } finally {
        setState({ phase: 'idle' })
        await ws.api.endSession(session.id)
        await ws.openSession(session.id)
      }
    })
  return {
    state,
    start,
    cancel: () => {
      cancelled.current = true
    },
  }
}
