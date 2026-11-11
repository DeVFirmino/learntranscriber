// The audio settings a recording reads, and the routes they choose.
export interface AudioSettings {
  microphoneId: string
  systemAudio: boolean
  systemAudioSource: string
  systemAudioInputDevice?: string
  liveTranscription?: boolean
  transcriptionProvider?: string
  echoReductionEnabled?: boolean
}

// ScreenCaptureKit and the process tap run in the native helper; the other routes are captured by this window.
export function helperRoute(source: string) {
  return source === 'native' || source === 'process-tap'
}

// Live captions run for the providers that stream; the others transcribe recorded segments.
export function liveCaptions(settings: AudioSettings) {
  return Boolean(
    settings.liveTranscription && ['local', 'apple', 'openai', 'gemini'].includes(settings.transcriptionProvider || ''),
  )
}

// Apple Speech receives the native helper's incoming audio in the main process, so the window does not forward it.
export function appleHearsHelper(settings: AudioSettings) {
  return settings.transcriptionProvider === 'apple' && settings.systemAudio && helperRoute(settings.systemAudioSource)
}
