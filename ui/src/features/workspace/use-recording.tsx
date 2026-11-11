import { useEffect } from 'react'
import type { RecordingTimer } from '@/audio/recording-timer'
import type { RecordingCoordinator } from './recording-coordinator'

// Keeps the recording reminder running only while the workspace records with the session timer on, and
// asks before closing the page while audio could still be lost.
export function useRecording({
  coordinator,
  timer,
  overlay,
  sessionTimer,
  audioRev,
}: {
  coordinator: RecordingCoordinator
  timer: RecordingTimer
  overlay: boolean
  sessionTimer: boolean | undefined
  audioRev: number
}) {
  useEffect(() => {
    if (coordinator.timerShouldRun(overlay, sessionTimer)) timer.start()
    else timer.stop()
    return () => {
      if (!coordinator.recording()) timer.stop()
    }
  }, [coordinator, audioRev, overlay, sessionTimer, timer])
  useEffect(() => () => timer.stop(), [timer])
  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!coordinator.blocksUnload()) return
      event.preventDefault()
      event.returnValue = 'Audio is still active or awaiting retry.'
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [coordinator, audioRev])
}
