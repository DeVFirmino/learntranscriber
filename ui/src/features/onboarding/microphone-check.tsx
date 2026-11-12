import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { microphoneFailure } from '@/audio/microphone-failure'
import { createMicrophoneProbe } from '@/audio/microphone-probe'
import { errorMessage } from '@/format'
import { useT } from '@/use-t'
import { levelBars } from './level-bars'

const base = import.meta.env.BASE_URL

// The microphone with a live level, the first proof that the app hears the person. With access already granted the
// meter starts on its own; otherwise Test microphone starts it, which is when macOS asks for access. Nothing records.
export function MicrophoneCheck({ deviceId, granted }: { deviceId: string; granted: boolean }) {
  const { t } = useT()
  const [level, setLevel] = useState(0)
  const [testing, setTesting] = useState(false)
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
  const start = useCallback(() => {
    void probe
      .start(deviceId)
      .then((active) => {
        setError('')
        setTesting(active)
      })
      .catch((reason: unknown) => setError(errorMessage(microphoneFailure(reason))))
  }, [probe, deviceId])
  useEffect(() => {
    if (granted) start()
    return () => {
      void probe.stop()
    }
  }, [probe, granted, start])
  return (
    <div className="onboarding-mic">
      <img src={`${base}onboarding/microphone.webp`} alt="" draggable={false} />
      <div className="onboarding-mic-body">
        <strong>{t('onboardingFlow.micTitle')}</strong>
        <small role={error ? 'alert' : undefined}>{error || t('onboardingFlow.micHint')}</small>
        {testing ? (
          <div
            className="onboarding-mic-meter"
            role="meter"
            aria-label={t('onboardingFlow.micTitle')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
          >
            {levelBars(level).map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        ) : (
          <Button size="sm" variant="secondary" className="onboarding-mic-test" onClick={start}>
            {t('onboardingFlow.micTest')}
          </Button>
        )}
      </div>
    </div>
  )
}
