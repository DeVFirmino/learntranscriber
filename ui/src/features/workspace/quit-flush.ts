export interface QuitAudio {
  recording: boolean
  stopping: boolean
  failed: unknown[]
  stop(): Promise<unknown>
  retry(): Promise<unknown>
}

// Quit waits for this, so the last recorded audio reaches transcription: stop recording, retry the segments that
// failed once, then report what is still unsent.
export async function flushBeforeQuit(
  audio: QuitAudio,
  api: { quitReady: (input: { discardedSegments: number }) => Promise<unknown> },
) {
  try {
    if (audio.recording || audio.stopping) await audio.stop()
  } catch {
    /* failed audio stays in audio.failed */
  }
  try {
    if (audio.failed.length) await audio.retry()
  } catch {
    /* still failed; reported below */
  }
  await api.quitReady({ discardedSegments: audio.failed.length }).catch(() => {})
}
