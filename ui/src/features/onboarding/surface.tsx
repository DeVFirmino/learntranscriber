import { useEffect, useRef, useState } from 'react'
import { BrandMark, BrandName } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { errorMessage } from '@/format'
import { showError } from '@/features/workspace/error-toast'
import { guideStep, onboardingProgress, type OnboardingStep } from './progress'
import { AiStep } from './ai-step'
import { GuideProgress } from './guide-progress'
import { ListeningSetup } from './listening-setup'
import { PermissionsStep } from './permissions-step'
import { OnboardingWelcome } from './welcome'
import { DemoStep } from './demo-step'
import { FinishStep } from './finish-step'
import { finishOnboarding } from './handoff'
import '../overlay/floating-tokens.css'
import './welcome.css'
import './steps.css'

function pinnedStep(step?: OnboardingStep): OnboardingStep | null {
  if (step === 'insights') return 'insights'
  if (step === 'transcription' || step === 'audioSource') return 'audioSource'
  if (step === 'permissions') return 'permissions'
  if (step === 'demo') return 'demo'
  return null
}

export function OnboardingSurface({ floating = false }: { floating?: boolean }) {
  const ws = useWorkspace()
  const api = ws.api
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [welcome, setWelcome] = useState(false)
  // A step the person moved to with Back or Continue; otherwise the first step that is not ready yet.
  const [view, setView] = useState<OnboardingStep | null>(null)
  const [speechAuthorization, setSpeechAuthorization] = useState<string>()
  const title = useRef<HTMLElement>(null)
  useEffect(() => {
    void api.presentOnboarding(true).catch((error: unknown) => showError(errorMessage(error)))
  }, [api])
  useEffect(() => {
    let current = true
    const refresh = async () => {
      if (ws.state?.settings.transcriptionProvider !== 'apple') return
      try {
        const status = await ws.api.speechCapabilities()
        if (current) setSpeechAuthorization(status.authorization)
      } catch {
        if (current) setSpeechAuthorization(undefined)
      }
    }
    void refresh()
    window.addEventListener('focus', refresh)
    return () => {
      current = false
      window.removeEventListener('focus', refresh)
    }
  }, [ws.api, ws.state?.settings.transcriptionProvider])
  const state = ws.state
  const progress = state ? onboardingProgress(state, { speechAuthorization }, ws.session) : null
  const derived = progress?.current
  const current = welcome ? 'welcome' : (view ?? derived)
  // A setup step stays on screen until Continue or Back, even when the choices made on it complete it; React's
  // adjust-state-while-rendering pattern pins it before the screen ever moves on.
  const pinned = pinnedStep(derived)
  if (!view && !welcome && pinned) setView(pinned)
  useEffect(() => {
    title.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [current])
  if (!state || !progress) return null
  const act = (task: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    void ws.act(task).finally(() => setBusy(false))
  }
  const close = () =>
    act(async () => {
      await ws.api.settings({ onboardingDismissed: true })
      await ws.api.presentOnboarding(false)
      if (floating) await ws.api.expandOverlay(false)
      else ws.go('home')
    })
  function renderStep() {
    if (!progress || !current) return null
    if (current === 'welcome')
      return (
        <OnboardingWelcome
          busy={busy}
          onStart={() =>
            act(async () => {
              await ws.api.settings({ onboardingStarted: true, onboardingDismissed: false })
              setWelcome(false)
            })
          }
        />
      )
    if (current === 'transcription' || current === 'audioSource')
      return <ListeningSetup busy={busy} onBack={() => setView('insights')} onContinue={() => setView('permissions')} />
    if (current === 'permissions')
      return (
        <PermissionsStep
          busy={busy}
          onBack={() => setView('audioSource')}
          onContinue={() =>
            act(async () => {
              await finishOnboarding({ api: ws.api, floating })
              if (!floating) ws.go('home')
            })
          }
          onExample={() => setView(progress.demoSeen ? 'finish' : 'demo')}
        />
      )
    if (current === 'insights')
      return <AiStep busy={busy} onBack={() => setWelcome(true)} onContinue={() => setView('audioSource')} />
    if (current === 'demo')
      return (
        <DemoStep
          busy={busy}
          onBack={() => setView('permissions')}
          onSeen={() =>
            act(async () => {
              await ws.api.settings({ onboardingDemoSeen: true })
            })
          }
          onContinue={() =>
            act(async () => {
              await ws.api.settings({ onboardingDemoSeen: true })
              setView('finish')
            })
          }
        />
      )
    return (
      <FinishStep
        busy={busy}
        configurationReady={progress.configurationReady}
        onBack={() => setView('demo')}
        onOpen={() =>
          act(async () => {
            await finishOnboarding({ api: ws.api, floating })
            if (!floating) ws.go('home')
          })
        }
      />
    )
  }

  return (
    <div data-floating className={`onboarding-stage ${floating ? 'onboarding-floating' : ''}`}>
      <section ref={title} className="onboarding-surface" aria-label={t('onboardingFlow.region')} aria-busy={busy}>
        <header className="onboarding-header">
          <span>
            <BrandMark className="h-4 w-5" />
            <BrandName />
          </span>
          <span className="onboarding-header-end">
            {current ? <GuideProgress step={guideStep(current)} /> : null}
            <Button size="sm" variant="ghost" className="onboarding-skip" disabled={busy} onClick={close}>
              {t('onboardingFlow.skip')}
            </Button>
          </span>
        </header>
        {renderStep()}
      </section>
    </div>
  )
}
