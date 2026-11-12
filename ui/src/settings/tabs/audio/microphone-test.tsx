import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { microphoneFailure } from '@/audio/microphone-failure'
import { createMicrophoneProbe } from '@/audio/microphone-probe'
import { useT } from '@/use-t'
import { errorMessage } from '@/format'

export function MicrophoneTest({
  deviceId,
  recording,
  liveLevel,
}: {
  deviceId: string
  recording: boolean
  liveLevel: number
}) {
  const { t } = useT()
  const [level, setLevel] = useState(0)
  const [testing, setTesting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [probe] = useState(() =>
    createMicrophoneProbe({
      open: (id) =>
        navigator.mediaDevices.getUserMedia({
          audio: { deviceId: id === 'default' ? undefined : { exact: id } },
          video: false,
        }),
      createContext: () => new AudioContext(),
      every: (read) => window.setInterval(read, 80),
      cancel: (id) => window.clearInterval(id),
      changed: setLevel,
    }),
  )
  useEffect(
    () => () => {
      void probe.stop()
    },
    [probe],
  )
  const percent = Math.round((recording ? liveLevel : level) * 100)
  return (
    <div className="microphone-test">
      <div className="microphone-test-row">
        <div
          className="audio-meter"
          role="meter"
          aria-label={t('audio.microphoneLevel')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="audio-meter-level" style={{ width: `${percent}%` }} />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="audio-probe-control"
          disabled={recording || starting}
          onClick={() => {
            if (testing) {
              setTesting(false)
              void probe.stop()
              return
            }
            setStarting(true)
            setError('')
            void probe
              .start(deviceId)
              .then((active) => setTesting(active))
              .catch((reason) => setError(errorMessage(microphoneFailure(reason))))
              .finally(() => setStarting(false))
          }}
        >
          {t(testing ? 'audio.stopMicrophoneTest' : 'audio.testMicrophone')}
        </Button>
      </div>
      <p className="microphone-test-hint" role={error ? 'alert' : 'status'}>
        {error || t(recording ? 'audio.levelWhileRecording' : 'audio.microphoneTestHint')}
      </p>
    </div>
  )
}
