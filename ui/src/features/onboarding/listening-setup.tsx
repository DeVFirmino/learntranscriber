import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Settings } from '@/bridge/types/settings'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import type { KeyProvider } from './ai-choice'
import { AiKeyForm } from './ai-key-form'
import {
  audioSourcePatch,
  listeningDefaults,
  transcriptionKeyMissing,
  type TranscriptionChoice,
} from './listening-choices'
import { MicrophoneCheck } from './microphone-check'
import { onboardingReadiness } from './readiness'
import './listening.css'

const CLOUD: Record<string, string> = { openai: 'OpenAI', gemini: 'Google Gemini' }
const ENGINES: TranscriptionChoice[] = ['apple', 'openai', 'gemini']

// What the conversation is heard from and which engine turns it into text. The first visit picks the computer's
// audio and Apple Speech; every change is saved as soon as it is made.
export function ListeningSetup({
  busy,
  onBack,
  onContinue,
}: {
  busy: boolean
  onBack: () => void
  onContinue: () => void
}) {
  const ws = useWorkspace()
  const { t } = useT()
  const [key, setKey] = useState('')
  const defaulted = useRef(false)
  const state = ws.state
  useEffect(() => {
    if (!state || defaulted.current) return
    defaulted.current = true
    const patch = listeningDefaults(state.settings)
    if (Object.keys(patch).length)
      void ws.act(async () => {
        await ws.api.settings(patch)
      })
  }, [state, ws])
  if (!state) return null
  const settings = state.settings
  const engine = settings.transcriptionProvider
  const readiness = onboardingReadiness(state)
  const keyMissing = transcriptionKeyMissing(state)
  const save = (patch: Partial<Settings>) =>
    void ws.act(async () => {
      await ws.api.settings(patch)
    })
  const saveKey = () =>
    void ws.act(async () => {
      await ws.api.saveKey({ provider: engine, key: key.trim() })
      setKey('')
    })
  const engineName = (value: string) => CLOUD[value] ?? t('onboardingFlow.speechApple')
  return (
    <div className="onboarding-step" data-onboarding-step="audioSource">
      <h1 tabIndex={-1}>{t('onboardingFlow.listenTitle')}</h1>
      <p>
        {engine === 'apple'
          ? t('onboardingFlow.listenApple')
          : t('onboardingFlow.listenCloud', { provider: engineName(engine) })}
      </p>
      <MicrophoneCheck deviceId={settings.microphoneId} granted={state.permissions.microphone === 'granted'} />
      <label className="onboarding-toggle-row">
        <span>
          <strong>{t('onboardingFlow.computerAudio')}</strong>
          <small>{t('onboardingFlow.computerAudioDetail')}</small>
        </span>
        <Switch
          checked={settings.onboardingAudioSource === 'computer'}
          disabled={busy}
          onCheckedChange={(on) => save(audioSourcePatch(on ? 'computer' : 'microphone'))}
        />
      </label>
      <div className="onboarding-transcription">
        <span id="onboarding-engine">{t('onboardingFlow.speechToText')}</span>
        <fieldset className="onboarding-chips" disabled={busy} aria-labelledby="onboarding-engine">
          {ENGINES.map((value) => (
            <label key={value} data-selected={value === engine}>
              <input
                type="radio"
                name="onboarding-engine"
                value={value}
                checked={value === engine}
                onChange={() => save({ transcriptionProvider: value })}
              />
              {engineName(value)}
            </label>
          ))}
        </fieldset>
        {keyMissing ? (
          <AiKeyForm
            providers={[engine as KeyProvider]}
            provider={engine as KeyProvider}
            value={key}
            disabled={busy}
            onProvider={() => {}}
            onChange={setKey}
            onSubmit={saveKey}
          />
        ) : null}
      </div>
      <div className="onboarding-actions">
        <Button variant="secondary" disabled={busy} onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {t('onboardingFlow.back')}
        </Button>
        {keyMissing ? (
          <Button className="onboarding-primary" disabled={busy || !key.trim()} onClick={saveKey}>
            {t('onboardingFlow.saveKey')}
          </Button>
        ) : (
          <Button
            className="onboarding-primary"
            disabled={busy || !readiness.transcription || !readiness.audioSource}
            onClick={onContinue}
          >
            {t('onboardingFlow.continue')}
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}
