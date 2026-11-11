import { useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Pause, Play, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'
import { lessonAction, type LessonState } from './lesson'
import './demo.css'

export function FinishStep({
  busy,
  configurationReady,
  onBack,
  onOpen,
}: {
  busy: boolean
  configurationReady: boolean
  onBack: () => void
  onOpen: () => void
}) {
  const { t } = useT()
  const [lesson, setLesson] = useState<LessonState>('listening')
  return (
    <div className="onboarding-step onboarding-finish" data-onboarding-step="finish">
      <h1 tabIndex={-1}>{t('onboardingDemo.readyTitle')}</h1>
      <p>{t('onboardingDemo.readyDescription')}</p>
      <div className="onboarding-demo-controls" aria-label={t('onboardingDemo.practice')}>
        <Button
          variant="secondary"
          disabled={busy || lesson === 'stopped'}
          aria-pressed={lesson === 'paused'}
          onClick={() => setLesson(lessonAction(lesson, 'pause'))}
        >
          {lesson === 'paused' ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          {t(lesson === 'paused' ? 'onboardingDemo.resume' : 'onboardingDemo.pause')}
        </Button>
        <Button
          variant="secondary"
          disabled={busy || lesson === 'stopped'}
          onClick={() => setLesson(lessonAction(lesson, 'stop'))}
        >
          <Square aria-hidden="true" />
          {t('onboardingDemo.stop')}
        </Button>
        {lesson === 'stopped' ? (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setLesson(lessonAction(lesson, 'replay'))}
            aria-label={t('onboardingDemo.replay')}
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        ) : null}
        <span role="status">{t(`onboardingDemo.${lesson}`)}</span>
      </div>
      <div className="onboarding-demo-sessions">
        <BookOpen aria-hidden="true" />
        <p>{t('onboardingDemo.sessions')}</p>
      </div>
      {!configurationReady ? <p className="onboarding-hint">{t('onboardingDemo.setupIncomplete')}</p> : null}
      <div className="onboarding-actions">
        <Button variant="secondary" disabled={busy} onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {t('onboardingFlow.back')}
        </Button>
        <Button className="onboarding-primary" disabled={busy} onClick={onOpen}>
          {t('onboardingDemo.open')}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
      <p className="onboarding-demo-notice">{t('onboardingDemo.controlsNotice')}</p>
    </div>
  )
}
