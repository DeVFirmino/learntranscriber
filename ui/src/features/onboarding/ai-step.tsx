import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { MessageKey } from '@/i18n'
import { activeChatGPT } from '@/settings/tabs/ai-sources/connected-sources'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { modelReady } from '../model-setup'
import {
  downloadBytes,
  initialAiChoice,
  localProgress,
  providerChoice,
  recommendedLocalModel,
  sizeLabel,
  type AiChoice,
  type KeyProvider,
} from './ai-choice'
import { connectChatGPT, connectKey, connectLocal } from './ai-connect'
import { AiKeyForm } from './ai-key-form'
import './ai-step.css'

const base = import.meta.env.BASE_URL
const CARDS: { value: AiChoice; image: string; label: MessageKey; detail: MessageKey }[] = [
  {
    value: 'chatgpt',
    image: 'ai-chat.webp',
    label: 'onboardingFlow.aiChatgpt',
    detail: 'onboardingFlow.aiChatgptDetail',
  },
  { value: 'key', image: 'ai-key.webp', label: 'onboardingFlow.aiKey', detail: 'onboardingFlow.aiKeyDetail' },
  { value: 'local', image: 'ai-local.webp', label: 'onboardingFlow.aiLocal', detail: 'onboardingFlow.aiLocalDetail' },
]
const ACTIONS: Record<AiChoice, MessageKey> = {
  chatgpt: 'onboardingFlow.aiSignIn',
  key: 'onboardingFlow.aiConnect',
  local: 'onboardingFlow.aiDownload',
}

// Connects the AI that answers without leaving the onboarding: each card runs the same sign-in, key or download the
// AI setup page runs, then picks a model, so the step is done once the app can answer.
export function AiStep({ busy, onBack, onContinue }: { busy: boolean; onBack: () => void; onContinue: () => void }) {
  const ws = useWorkspace()
  const { t } = useT()
  const [choice, setChoice] = useState<AiChoice>(() => initialAiChoice(ws.state?.settings.provider ?? ''))
  const [provider, setProvider] = useState<KeyProvider>('openai')
  const [key, setKey] = useState('')
  const [working, setWorking] = useState(false)
  const state = ws.state
  if (!state) return null
  const connected = modelReady(state) && providerChoice(state.settings.provider) === choice
  const local = recommendedLocalModel(state.modelCatalog)
  const percent = localProgress(state.localModels)
  const locked = busy || working
  const run = (task: () => Promise<void>) => {
    setWorking(true)
    void ws.act(task).finally(() => setWorking(false))
  }
  const connect = () => {
    if (choice === 'chatgpt') run(() => connectChatGPT(ws.api, Boolean(activeChatGPT(state))))
    else if (choice === 'key') run(() => connectKey(ws.api, provider, key))
    else run(() => connectLocal(ws.api, state.localModels, state.modelCatalog))
  }
  const modelName =
    state.localModels.models.find((model) => model.id === state.settings.model)?.name ?? state.settings.model
  const size = sizeLabel(local ? downloadBytes(local) : 0)
  return (
    <div className="onboarding-step" data-onboarding-step="insights">
      <h1 tabIndex={-1}>{t('onboardingFlow.aiTitle')}</h1>
      <p>{t('onboardingFlow.aiDescription')}</p>
      <fieldset className="onboarding-ai-cards" disabled={locked}>
        <legend className="sr-only">{t('onboardingFlow.aiTitle')}</legend>
        {CARDS.map((card) => (
          <label key={card.value} className="onboarding-ai-card" data-selected={card.value === choice}>
            <input
              type="radio"
              name="onboarding-ai"
              value={card.value}
              checked={card.value === choice}
              onChange={() => setChoice(card.value)}
            />
            <img src={`${base}onboarding/${card.image}`} alt="" draggable={false} />
            <span className="onboarding-choice-text">
              <strong>{t(card.label)}</strong>
              <small>{t(card.detail, { size })}</small>
            </span>
            {card.value === 'chatgpt' ? (
              <span className="onboarding-ai-badge">{t('onboardingFlow.aiRecommended')}</span>
            ) : null}
          </label>
        ))}
      </fieldset>
      {choice === 'key' && !connected ? (
        <AiKeyForm
          provider={provider}
          value={key}
          disabled={locked}
          onProvider={setProvider}
          onChange={setKey}
          onSubmit={connect}
        />
      ) : null}
      {choice === 'local' && working && percent !== null ? (
        <Progress className="onboarding-ai-progress" value={percent} aria-label={t('onboardingFlow.aiDownload')} />
      ) : null}
      {connected ? (
        <p className="onboarding-ai-connected" role="status">
          <Check aria-hidden="true" />
          {t('onboardingFlow.aiConnected', { model: modelName })}
        </p>
      ) : null}
      <div className="onboarding-actions">
        <Button variant="secondary" disabled={locked} onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {t('onboardingFlow.back')}
        </Button>
        {connected ? (
          <Button className="onboarding-primary" disabled={busy} onClick={onContinue}>
            {t('onboardingFlow.continue')}
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : (
          <Button
            className="onboarding-primary"
            disabled={locked || (choice === 'key' && !key.trim())}
            onClick={connect}
          >
            {working ? <WorkingLabel choice={choice} percent={percent} /> : t(ACTIONS[choice])}
          </Button>
        )}
      </div>
    </div>
  )
}

function WorkingLabel({ choice, percent }: { choice: AiChoice; percent: number | null }) {
  const { t } = useT()
  if (choice === 'chatgpt') return t('onboardingFlow.aiSigningIn')
  if (choice === 'local' && percent !== null) return t('onboardingFlow.aiDownloading', { percent })
  return t('onboardingFlow.aiConnecting')
}
