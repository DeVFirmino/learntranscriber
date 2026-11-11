import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { showError } from './error-toast'
import { echoReduction } from '@/audio/aec3-module'
import { AudioCapture } from '@/audio/capture'
import { RecordingTimer } from '@/audio/recording-timer'
import type { WorkspaceApi } from '@/bridge/types/api'
import { errorMessage, localizeMessage } from '@/format'
import { RecordingCoordinator } from './recording-coordinator'
import { useRecording } from './use-recording'
import { readOverlay } from './window-location'

// The window's audio capture and what follows it: echo reduction, the floating bar's listening state, the recording
// reminder and the capture's own native listeners.
export function useWorkspaceAudio(
  api: WorkspaceApi,
  settings: { overlay: boolean; echoReductionEnabled: boolean; sessionTimer: boolean | undefined },
) {
  const [audioRev, setAudioRev] = useState(0)
  const [recordingReminder, setRecordingReminder] = useState(false)
  const [audio] = useState(
    () =>
      new AudioCapture(
        api,
        (message) => {
          if (message) showError(message)
          setAudioRev((value) => value + 1)
        },
        {
          echo: echoReduction,
          // Only the workspace records; it reports each side's loudness for the floating bar's wave.
          onLevels: (levels) => void api.reportAudioLevels(levels).catch(() => undefined),
        },
      ),
  )
  const [recording] = useState(() => new RecordingCoordinator(audio))
  const [recordingTimer] = useState(
    () =>
      new RecordingTimer(setRecordingReminder, () => {
        void recording
          .pauseForReminder()
          .then((paused) => {
            if (paused) toast.message(localizeMessage('Listening paused because the recording reminder expired.'))
          })
          .catch((error: unknown) => showError(errorMessage(error)))
      }),
  )
  // Echo reduction follows the setting, also while a recording runs.
  useEffect(() => {
    audio.updateEchoReduction(settings.echoReductionEnabled)
  }, [audio, settings.echoReductionEnabled])
  // The floating bar shows preparation until audio is ready, then its listening timer. The capture objects are
  // created once; audioRev is what changes when their state does.
  useEffect(() => {
    if (readOverlay()) return
    void api
      .reportListening(audio.recording && !recording.starting, recording.starting, audio.recording && audio.paused)
      .catch(() => {})
  }, [api, audio, recording, audioRev])
  useRecording({
    coordinator: recording,
    timer: recordingTimer,
    overlay: settings.overlay,
    sessionTimer: settings.sessionTimer,
    audioRev,
  })
  // The capture's own native listeners follow this effect, so a StrictMode remount reconnects them.
  useEffect(() => {
    audio.connect()
    return () => audio.dispose()
  }, [audio])
  const toggle = (ensureSession: () => Promise<void>) =>
    recording.toggle(
      ensureSession,
      () => api.state(),
      (starting) => api.reportListening(!starting && audio.recording, starting).catch(() => {}),
    )
  const actions = {
    audio,
    continueRecording: () => recordingTimer.continue(),
    setDictating: (active: boolean) => recording.setDictating(active),
  }
  return { audio, audioRev, recording, recordingReminder, toggle, actions }
}
