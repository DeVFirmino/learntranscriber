import { useEffect, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { elapsedSeconds, formatElapsed } from '@/features/overlay/listening-clock'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import type { LiveSession } from './live-session-state'

// The running clock, ticking on its own so the rest of Home does not render every second.
export function LiveClock({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <span role="timer" className="home-live-clock">
      {formatElapsed(elapsedSeconds(since, now))}
    </span>
  )
}

// What a running recording offers from Home: open its session first, then pause or resume, and stop.
export function LiveControls({ live }: { live: LiveSession }) {
  const ws = useWorkspace()
  const { t } = useT()
  const shortcut = (action: string) => () => void ws.act(() => ws.api.dispatchShortcut(action).then(() => undefined))
  const session = live.session
  return (
    <>
      {session ? (
        <ActionButton onClick={() => void ws.act(() => ws.openSession(session.id))}>{t('home.liveOpen')}</ActionButton>
      ) : null}
      <Button variant="outline" onClick={shortcut('pauseRecording')}>
        {live.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        {live.paused ? t('home.liveResume') : t('home.livePause')}
      </Button>
      <Button variant="outline" onClick={shortcut('toggleRecording')}>
        <Square aria-hidden="true" />
        {t('home.liveStop')}
      </Button>
    </>
  )
}
