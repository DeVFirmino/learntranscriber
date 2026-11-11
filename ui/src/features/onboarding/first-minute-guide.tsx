import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { SessionDetail } from '@/bridge/types/sessions'
import { Button } from '@/components/ui/button'
import type { MessageKey } from '@/i18n'
import { elapsedSeconds, formatElapsed } from '@/features/overlay/listening-clock'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { firstTryStage, shortcutKeys, type FirstTryStage } from './first-try'
import { sessionMilestones } from './progress'
import './first-try.css'

const HINTS: Record<FirstTryStage, MessageKey> = {
  start: 'firstTry.panelStart',
  listen: 'firstTry.listen',
  ask: 'firstTry.ask',
  done: 'firstTry.done',
}

// Coaches the first real session from the panel: how long it has listened, whether something was heard and answered,
// and the next thing to try. Finish stops listening and ends the guide; the session itself stays in Sessions.
export function FirstMinuteGuide({ session }: { session: SessionDetail | null }) {
  const ws = useWorkspace()
  const { t } = useT()
  const [now, setNow] = useState(() => Date.now())
  const since = ws.state?.overlay.listening?.since ?? null
  useEffect(() => {
    if (!since) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [since])
  const state = ws.state
  if (!state?.settings.onboardingGuide) return null
  const listening = state.overlay.listening
  const milestones = sessionMilestones(session)
  const stage = firstTryStage(milestones, Boolean(listening?.active || listening?.starting))
  const keys = shortcutKeys(state.shortcutDefinitions, stage === 'ask' ? 'ask' : 'record')
  const finish = () =>
    void ws.act(async () => {
      if (listening?.active) await ws.api.dispatchShortcut('toggleRecording')
      await ws.api.settings({ onboardingGuide: false })
    })
  return (
    <div className="first-minute" role="status">
      <div className="first-minute-head">
        <strong>{t('firstTry.title')}</strong>
        {since ? <span className="first-minute-clock">{formatElapsed(elapsedSeconds(since, now))}</span> : null}
        <span className="first-minute-check" data-done={milestones.transcript}>
          {milestones.transcript ? <Check aria-hidden="true" /> : null}
          {t('firstTry.transcript')}
        </span>
        <span className="first-minute-check" data-done={milestones.answer}>
          {milestones.answer ? <Check aria-hidden="true" /> : null}
          {t('firstTry.answer')}
        </span>
        <Button size="sm" variant={stage === 'done' ? 'secondary' : 'ghost'} onClick={finish}>
          {t(stage === 'done' ? 'firstTry.finish' : 'firstTry.hide')}
        </Button>
      </div>
      <p>{t(HINTS[stage], { keys })}</p>
    </div>
  )
}
