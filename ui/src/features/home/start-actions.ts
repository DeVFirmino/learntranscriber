export function createStartActions({
  ensureSession,
  startFloatingSession,
  recording,
  toggleListening,
  captureScreen,
  quickScreenshot,
  attached,
  focusQuestion,
}: {
  ensureSession: () => Promise<void>
  startFloatingSession: () => Promise<void>
  recording: () => boolean
  toggleListening: () => Promise<void>
  captureScreen: () => Promise<void>
  quickScreenshot: () => boolean
  attached: () => void
  focusQuestion: () => void
}) {
  return {
    // One click from Home to a recording: the session opens in the floating bar and listening starts there.
    async start() {
      await startFloatingSession()
      if (!recording()) await toggleListening()
    },
    async capture() {
      await captureScreen()
      if (!quickScreenshot()) attached()
    },
    async ask() {
      await ensureSession()
      focusQuestion()
    },
  }
}
