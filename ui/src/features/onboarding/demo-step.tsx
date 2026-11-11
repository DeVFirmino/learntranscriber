import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw, NotebookPen } from 'lucide-react'
import { BrandListen } from '@/components/brand-icon'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useT } from '@/use-t'
import { compareDemoAssistant, selectDemoAssistant } from './demo-assistants'
import { demoFrame, playDemo } from './demo-playback'
import { DemoAssistantSelect } from './demo-assistant-select'
import { DemoConversation } from './demo-conversation'
import './demo.css'

const motionQuery = '(prefers-reduced-motion: reduce)'
const readMotion = () => window.matchMedia(motionQuery).matches
const subscribeMotion = (listener: () => void) => {
  const media = window.matchMedia(motionQuery)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

export function DemoStep({
  busy,
  onBack,
  onSeen,
  onContinue,
}: {
  busy: boolean
  onBack: () => void
  onSeen: () => void
  onContinue: () => void
}) {
  const { t } = useT()
  const phrase = t('onboardingDemo.phrase')
  const [selection, setSelection] = useState(() => selectDemoAssistant('general'))
  const [frame, setFrame] = useState(() => demoFrame(null, phrase))
  const [playing, setPlaying] = useState(false)
  const reducedMotion = useSyncExternalStore(subscribeMotion, readMotion, () => false)
  const reported = useRef(false)
  const conversation = useRef<HTMLDivElement>(null)
  const complete = frame.phase === 'insight'
  useEffect(() => {
    if (!playing) return
    return playDemo({
      phrase,
      reducedMotion,
      now: () => performance.now(),
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: (timer) => window.clearTimeout(timer),
      onFrame: (value) => {
        setFrame(value)
        if (value.phase === 'insight') setPlaying(false)
      },
    })
  }, [playing, phrase, reducedMotion])
  useEffect(() => {
    if (!complete || reported.current) return
    reported.current = true
    conversation.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    conversation.current?.scrollTo({
      top: conversation.current.scrollHeight,
      behavior: reducedMotion ? 'instant' : 'smooth',
    })
    onSeen()
  }, [complete, onSeen, reducedMotion])
  return (
    <div className="onboarding-step onboarding-demo" data-onboarding-step="demo" data-demo-phase={frame.phase}>
      <div className="onboarding-demo-heading">
        <h1 tabIndex={-1}>{t(complete ? 'onboardingDemo.insightTitle' : 'onboardingDemo.title')}</h1>
        <Button size="sm" variant="ghost" disabled={busy || playing} onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {t('onboardingFlow.back')}
        </Button>
      </div>
      <DemoAssistantSelect
        value={selection.assistant}
        disabled={busy || playing}
        onChange={(id) => setSelection(selectDemoAssistant(id))}
      />
      <p className="onboarding-demo-status" role="status">
        {t(`onboardingDemo.${frame.phase}Status`)}
      </p>
      <Progress value={frame.progress} aria-label={t('onboardingDemo.progress')} />
      <div className="onboarding-demo-scroll" ref={conversation}>
        <DemoConversation frame={frame} assistant={selection.assistant} />
      </div>
      {frame.phase === 'idle' ? (
        <Button
          className="onboarding-primary onboarding-demo-start"
          disabled={busy}
          aria-describedby="onboarding-demo-notice"
          onClick={() => {
            setFrame(demoFrame(0, phrase, reducedMotion))
            setPlaying(true)
          }}
        >
          <BrandListen aria-hidden="true" />
          {t('onboardingDemo.start')}
        </Button>
      ) : null}
      {complete ? (
        <div className="onboarding-actions onboarding-demo-actions">
          {selection.assistant !== 'notes' || selection.comparedFrom ? (
            <Button variant="secondary" disabled={busy} onClick={() => setSelection(compareDemoAssistant(selection))}>
              <NotebookPen aria-hidden="true" />
              {selection.comparedFrom ? t('onboardingDemo.returnAssistant') : t('onboardingDemo.tryNotes')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setFrame(demoFrame(null, phrase))
              }}
            >
              <RotateCcw aria-hidden="true" />
              {t('onboardingDemo.replay')}
            </Button>
          )}
          <Button className="onboarding-primary" disabled={busy} onClick={onContinue}>
            {t('onboardingFlow.continue')}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      <p id="onboarding-demo-notice" className="onboarding-demo-notice">
        {t('onboardingDemo.notice')}
      </p>
    </div>
  )
}
