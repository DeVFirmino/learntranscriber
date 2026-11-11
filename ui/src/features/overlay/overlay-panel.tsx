import { floatingFontSize } from './reading-size'
import type { RefObject } from 'react'
import { PanelScroll } from './panel-scroll'
import type { SessionDetail } from '@/bridge/types/sessions'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { FirstMinuteGuide } from '@/features/onboarding/first-minute-guide'
import { AnswersView } from './answers-view'
import { PanelHeader } from './panel-header'
import { PanelSettings } from './panel-settings'
import type { View } from './panel-view'
import { QuestionForm } from './question-form'
import { SummaryView } from './summary-view'
import { TranscriptView } from './transcript-view'
import { usePanelScrollActions } from './use-panel-scroll-actions'

// The session panel above the bar: Transcript, Session and Summary tabs, their settings row and, on the Session
// tab, the question box. Its tab, settings row and question draft belong to the window, so they survive collapsing.
export function OverlayPanel({
  view,
  onView,
  settingsOpen,
  onSettingsOpen,
  session,
  question,
  onQuestion,
  questionRef,
}: {
  view: View
  onView: (view: View) => void
  settingsOpen: boolean
  onSettingsOpen: (open: boolean) => void
  session: SessionDetail | null
  question: string
  onQuestion: (value: string) => void
  questionRef: RefObject<HTMLTextAreaElement | null>
}) {
  const ws = useWorkspace()
  const { t } = useT()
  usePanelScrollActions(view)
  const state = ws.state
  if (!state) return null
  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface/95 shadow-2xl"
      data-session-panel
      aria-label={t('overlay.panel')}
    >
      <PanelHeader
        view={view}
        onView={onView}
        settingsOpen={settingsOpen}
        onSettingsOpen={onSettingsOpen}
        onResize={(size) => void ws.api.resizeOverlay(size)}
        onMinimize={() =>
          void ws.act(async () => {
            await ws.api.expandOverlay(false)
          })
        }
      />
      {settingsOpen ? <PanelSettings view={view} /> : null}
      <FirstMinuteGuide session={session} />
      <PanelScroll
        key={`${session?.id || ''}:${view}`}
        follow={state.settings.autoScroll}
        style={{ fontSize: floatingFontSize(state.settings.unifiedModalFontScale) }}
      >
        {view === 'transcript' ? <TranscriptView session={session} /> : null}
        {view === 'session' ? <AnswersView session={session} /> : null}
        {view === 'summary' ? <SummaryView session={session} /> : null}
      </PanelScroll>
      {view === 'session' ? (
        <QuestionForm question={question} onQuestion={onQuestion} questionRef={questionRef} />
      ) : null}
    </section>
  )
}
