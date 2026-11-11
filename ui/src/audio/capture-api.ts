import type { Unsubscribe } from '@/bridge/types/subscription'
import type { LiveCaption } from '@/bridge/types/audio'

export interface CaptureSegment {
  sessionId: string
  speaker: string
  mime: string
  bytes: ArrayBuffer
  /** Stable per recorded segment, so a retry after a lost response cannot append twice. */
  segmentId?: string
}

// The part of the bridge the recording uses: transcription, live captions and the native helper's incoming audio.
export interface CaptureApi {
  startLiveTranscription?: (id: string) => Promise<boolean>
  pushLiveAudio?: (input: { sessionId: string; speaker: string; samples: ArrayBuffer }) => Promise<boolean>
  stopLiveTranscription?: () => Promise<boolean>
  setLivePaused?: (paused: boolean) => Promise<boolean>
  onLiveCaption?: (listener: (caption: LiveCaption) => void) => Unsubscribe
  transcribe: (segment: CaptureSegment) => Promise<unknown>
  startSystemAudio?: (id: string) => Promise<unknown>
  stopSystemAudio?: () => Promise<unknown>
  acquireSystemAudio?: (
    lease: string,
    id: string,
  ) => Promise<{ cancelled?: boolean; error?: string; fellBack?: boolean; reason?: string }>
  releaseSystemAudio?: (lease: string) => Promise<unknown>
  onSystemAudio?: (listener: (segment: CaptureSegment) => void) => Unsubscribe
  onSystemAudioError?: (listener: (message: string) => void) => Unsubscribe
}
