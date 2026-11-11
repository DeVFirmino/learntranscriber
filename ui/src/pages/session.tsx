import { ActionButton } from '@/components/ui/action-button'
import { PanelTop } from 'lucide-react'
import { SessionActions } from '@/features/session-actions'
import { EndSession } from '@/features/end-session'
import '@/features/session/session-layout.css'
import { Button } from '@/components/ui/button'
import { PageHeading } from '@/components/chrome'
import { SessionChat } from '@/features/session/session-chat'
import { SessionHeading } from '@/features/session/session-heading'
import { SessionListening } from '@/features/session/session-listening'
import { SessionNotes } from '@/features/session/session-notes'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

export function Session() {
  const ws = useWorkspace()
  const { t } = useT()
  if (!ws.state) return null
  const session = ws.session
  if (!session) {
    return (
      <PageHeading title={t('session.title')} description={t('session.choose')}>
        <ActionButton onClick={() => void ws.act(() => ws.startFloatingSession())}>{t('sessions.new')}</ActionButton>
      </PageHeading>
    )
  }
  const active = ws.state.activeSessionId === session.id
  return (
    <div>
      <SessionHeading key={session.id} session={session} />
      <SessionListening active={active}>
        <Button variant="outline" onClick={() => void ws.act(() => ws.api.toggleOverlay().then(() => undefined))}>
          <PanelTop className="size-4" aria-hidden="true" />
          {t('home.floating')}
        </Button>
        <SessionActions session={session} active={active} summaryDraft={null} />
        <EndSession key={session.id} session={session} active={active} />
        {!active ? (
          <ActionButton onClick={() => void ws.act(() => ws.api.resumeSession(session.id).then(() => undefined))}>
            {t('session.resume')}
          </ActionButton>
        ) : null}
      </SessionListening>
      <div className="session-columns">
        <SessionNotes session={session} />
        <SessionChat session={session} />
      </div>
    </div>
  )
}
