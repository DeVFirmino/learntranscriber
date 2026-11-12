// A refused microphone request as a message the user can act on: the browser's own text names neither the macOS
// setting nor the device. The messages are English like every audio error and shown translated (format.ts).
const DENIED = 'Microphone access is off. Allow LearnTranscriber in System Settings → Privacy & Security → Microphone.'
const MISSING = 'The selected microphone is not connected. Choose another one in Settings → Audio.'
const BUSY = 'The microphone is in use or unavailable. Close other apps that use it and try again.'

const MESSAGES: Record<string, string> = {
  NotAllowedError: DENIED,
  SecurityError: DENIED,
  NotFoundError: MISSING,
  OverconstrainedError: MISSING,
  NotReadableError: BUSY,
}

export function microphoneFailure(error: unknown): unknown {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  const message = MESSAGES[name]
  return message ? new Error(message) : error
}
